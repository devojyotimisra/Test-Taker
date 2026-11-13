import { CatalogItem, Paper, Question } from "../types";
import { fetchJsonWithFallback, preloadPaperAssets, resolveImageSource } from "./assetService";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderLatexText(text: string | null | undefined): string {
  if (!text) return "";

  const pattern = /\[IMAGE:\s*([^\]]+)\]/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(text.slice(lastIndex, match.index));
    }

    const raw = match[1].trim();
    let src = raw;
    let isBlock = false;

    if (raw.includes("|")) {
      const parts = raw.split("|");
      src = parts[0].trim();
      const mode = parts[1]?.trim().toLowerCase();
      isBlock = mode === "block";
    } else {
      isBlock =
        raw.toLowerCase().endsWith(".jpg") ||
        raw.toLowerCase().endsWith(".jpeg");
    }

    const { primary, fallback } = resolveImageSource(src);
    const fbAttr = fallback && fallback !== primary ? ` data-fallback="${escapeHtml(fallback)}"` : "";

    if (isBlock) {
      result += `<div class="latex-img-block"><img src="${escapeHtml(primary)}"${fbAttr} alt="Diagram" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" /></div>`;
    } else {
      result += `<img class="latex-img-inline" src="${escapeHtml(primary)}"${fbAttr} alt="Formula" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" />`;
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }

  return result.replace(/\n/g, "<br />");
}

function getOptionLetter(options: string[] | null | undefined, answer: string): string | null {
  if (!options || !Array.isArray(options)) return null;
  const target = answer.trim().toLowerCase();
  const idx = options.findIndex((opt) => opt.trim().toLowerCase() === target);
  if (idx !== -1) {
    return String.fromCharCode(65 + idx);
  }
  return null;
}

function isOptionCorrect(q: Question, opt: string): boolean {
  if (q.correct_answer === undefined || q.correct_answer === null) {
    return false;
  }
  const cleanOpt = opt.trim().toLowerCase();
  if (Array.isArray(q.correct_answer)) {
    return q.correct_answer.some((ans) => String(ans).trim().toLowerCase() === cleanOpt);
  }
  return String(q.correct_answer).trim().toLowerCase() === cleanOpt;
}

function formatCorrectAnswerText(q: Question): string {
  if (q.correct_answer === undefined || q.correct_answer === null || q.correct_answer === "") {
    return "Not specified in key";
  }

  if (Array.isArray(q.correct_answer)) {
    const parts = q.correct_answer.map((ans) => {
      const letter = getOptionLetter(q.options, String(ans));
      return letter ? `(${letter}) ${String(ans)}` : String(ans);
    });
    return parts.join("  •  ");
  }

  if (q.options && q.options.length > 0) {
    const letter = getOptionLetter(q.options, String(q.correct_answer));
    if (letter) {
      return `(${letter}) ${String(q.correct_answer)}`;
    }
  }

  return String(q.correct_answer);
}

function buildLatexHtml(paper: Paper, item: CatalogItem): string {
  const title = escapeHtml(item.course_name || paper.title || "Examination Paper");
  const code = escapeHtml(item.course_code || "");
  const term = escapeHtml(item.term || "");
  const year = escapeHtml(String(item.year || ""));
  const examType = escapeHtml(item.exam_type || "Examination");
  const totalMarks = paper.total_marks || item.total_marks || 0;
  const totalQuestions = paper.questions?.length || paper.total_questions || item.total_questions || 0;

  const questionsHtml = (paper.questions || [])
    .map((q: Question, idx: number) => {
      const qNum = q.number || idx + 1;
      const marksLabel = `${q.marks || 0} Mark${q.marks === 1 ? "" : "s"}`;
      const negLabel = q.negative_marks ? `, -${q.negative_marks}` : "";
      const typeBadge = q.type ? `<span class="latex-type-badge">${escapeHtml(q.type)}</span>` : "";

      let passageHtml = "";
      if (q.comprehension_passage && q.comprehension_passage.trim()) {
        passageHtml = `
          <div class="latex-passage-box">
            <div class="latex-passage-title">Comprehension / Reference Data:</div>
            <div class="latex-passage-body">${renderLatexText(q.comprehension_passage)}</div>
          </div>
        `;
      }

      let optionsHtml = "";
      if (q.options && q.options.length > 0) {
        optionsHtml = `
          <div class="latex-options-container">
            ${q.options
              .map((opt, optIdx) => {
                const label = String.fromCharCode(65 + optIdx);
                const isCorrect = isOptionCorrect(q, opt);
                return `
                  <div class="latex-option-row ${isCorrect ? "latex-option-correct" : ""}">
                    <span class="latex-option-letter">(${label})</span>
                    <span class="latex-option-content">${renderLatexText(opt)}</span>
                    ${isCorrect ? `<span class="latex-correct-tag">&#10004; Correct</span>` : ""}
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }

      const answerBoxHtml = `
        <div class="latex-answer-box">
          <span class="latex-answer-badge">&#10004; Correct Answer</span>
          <span class="latex-answer-text">${renderLatexText(formatCorrectAnswerText(q))}</span>
        </div>
      `;

      const sectionDivider =
        q.section_name && (idx === 0 || paper.questions?.[idx - 1]?.section_name !== q.section_name)
          ? `<div class="latex-section-divider"><span>SECTION: ${escapeHtml(q.section_name)}</span></div>`
          : "";

      return `
        ${sectionDivider}
        <article class="latex-question-card">
          <div class="latex-q-header">
            <span class="latex-q-title">Q.${qNum}</span>
            <span class="latex-q-meta">
              ${typeBadge}
              <span class="latex-marks-badge">[${marksLabel}${negLabel}]</span>
            </span>
          </div>
          ${passageHtml}
          <div class="latex-q-body">${renderLatexText(q.text)}</div>
          ${optionsHtml}
          ${answerBoxHtml}
        </article>
      `;
    })
    .join("");

  const summaryRowsHtml = (paper.questions || [])
    .map((q: Question, idx: number) => {
      const qNum = q.number || idx + 1;
      return `
        <tr>
          <td style="font-weight: bold; text-align: center;">Q.${qNum}</td>
          <td style="text-align: center;">${escapeHtml(q.type || "MCQ")}</td>
          <td style="text-align: center;">${q.marks || 0}</td>
          <td style="color: #065f46; font-weight: 600;">${renderLatexText(formatCorrectAnswerText(q))}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <div class="latex-doc-root">
    <style id="latex-pdf-internal-styles">
      .latex-doc-root {
        font-family: "Latin Modern Roman", "Computer Modern Roman", "Times New Roman", Times, Georgia, serif;
        font-size: 10.5pt;
        line-height: 1.45;
        color: #111111;
        background: #ffffff;
        padding: 12px 16px;
        box-sizing: border-box;
      }
      .latex-header {
        text-align: center;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 2px solid #111111;
      }
      .latex-inst {
        font-size: 13pt;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .latex-degree {
        font-size: 10pt;
        font-weight: 600;
        color: #333333;
        margin-bottom: 6px;
      }
      .latex-meta-table {
        width: 100%;
        margin: 6px 0;
        border-top: 1px solid #222222;
        border-bottom: 1px solid #222222;
        padding: 5px 0;
        font-size: 9.5pt;
        border-collapse: collapse;
      }
      .latex-meta-table td {
        padding: 2px 6px;
        vertical-align: top;
      }
      .latex-instructions {
        text-align: left;
        font-size: 8.5pt;
        color: #444444;
        line-height: 1.35;
        margin-top: 6px;
      }
      .latex-instructions ul {
        margin: 3px 0 0 16px;
        padding: 0;
      }
      .latex-section-divider {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        border-bottom: 1.5px solid #222222;
        padding-bottom: 4px;
        margin: 20px 0 12px 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-question-card {
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px dotted #cccccc;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-q-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 5px;
      }
      .latex-q-title {
        font-weight: 700;
        font-size: 11pt;
      }
      .latex-q-meta {
        font-size: 9pt;
        color: #333333;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .latex-type-badge {
        font-family: "Courier New", Courier, monospace;
        font-size: 8pt;
        font-weight: 700;
        padding: 1px 4px;
        border: 1px solid #888888;
        border-radius: 3px;
        background: #f4f4f4;
      }
      .latex-marks-badge {
        font-weight: 600;
      }
      .latex-passage-box {
        background: #f9f9f9;
        border-left: 3px solid #222222;
        padding: 6px 10px;
        margin: 6px 0 10px 0;
        font-size: 9.5pt;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-passage-title {
        font-weight: 700;
        font-size: 8pt;
        text-transform: uppercase;
        color: #555555;
        margin-bottom: 3px;
      }
      .latex-passage-body {
        line-height: 1.4;
      }
      .latex-q-body {
        font-size: 10.5pt;
        line-height: 1.45;
        margin-bottom: 8px;
      }
      .latex-options-container {
        margin-left: 10px;
        margin-top: 6px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-option-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 10pt;
        line-height: 1.4;
        padding: 3px 6px;
        border-radius: 4px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-option-correct {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        font-weight: 600;
      }
      .latex-option-letter {
        font-weight: 700;
        min-width: 20px;
        color: #222222;
      }
      .latex-option-content {
        flex: 1;
      }
      .latex-correct-tag {
        font-family: "Courier New", Courier, monospace;
        font-size: 8pt;
        font-weight: 700;
        color: #047857;
        background: #d1fae5;
        border: 1px solid #6ee7b7;
        padding: 1px 6px;
        border-radius: 9999px;
        margin-left: 6px;
      }
      .latex-answer-box {
        margin-top: 8px;
        padding: 6px 10px;
        background: #f0fdf4;
        border-left: 3px solid #10b981;
        border-radius: 0 4px 4px 0;
        font-size: 9.5pt;
        display: flex;
        align-items: baseline;
        gap: 8px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-answer-badge {
        font-weight: 700;
        color: #047857;
        font-size: 9pt;
        white-space: nowrap;
      }
      .latex-answer-text {
        color: #065f46;
        font-weight: 600;
      }
      .latex-summary-section {
        margin-top: 24px;
        padding-top: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
        margin-top: 8px;
      }
      .latex-summary-table th {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        padding: 4px 6px;
        font-weight: 700;
        text-align: center;
      }
      .latex-summary-table td {
        border: 1px solid #e5e7eb;
        padding: 3px 6px;
        vertical-align: middle;
      }
      .latex-summary-table tr:nth-child(even) {
        background: #f9fafb;
      }
      .latex-img-block {
        text-align: center;
        margin: 8px 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .latex-img-block img {
        max-width: 90%;
        max-height: 340px;
        height: auto;
        object-fit: contain;
        display: inline-block;
      }
      .latex-img-inline {
        display: inline-block;
        vertical-align: middle;
        max-height: 28px;
        max-width: 90%;
        margin: 0 2px;
        background: #ffffff;
      }
    </style>
    <header class="latex-header">
      <div class="latex-inst">Indian Institute of Technology Madras</div>
      <div class="latex-degree">BS Degree Programme &bull; Official Assessment Paper &amp; Solutions</div>
      <table class="latex-meta-table">
        <tr>
          <td><strong>Course Code:</strong> ${code}</td>
          <td><strong>Course:</strong> ${title}</td>
        </tr>
        <tr>
          <td><strong>Term &amp; Year:</strong> ${term} ${year}</td>
          <td><strong>Exam Type:</strong> ${examType}</td>
        </tr>
        <tr>
          <td><strong>Total Questions:</strong> ${totalQuestions}</td>
          <td><strong>Maximum Marks:</strong> ${totalMarks}</td>
        </tr>
      </table>
      <div class="latex-instructions">
        <strong>INSTRUCTIONS &amp; ANSWER KEY:</strong>
        <ul>
          <li>This document contains the complete question paper alongside verified correct answers.</li>
          <li>Each question displays its marks allocation, negative marks (if applicable), and correct option.</li>
          <li>A complete Answer Key Summary table is provided at the end of the document.</li>
        </ul>
      </div>
    </header>
    <main>
      ${questionsHtml}
      <section class="latex-summary-section">
        <div class="latex-section-divider">
          <span>ANSWER KEY SUMMARY</span>
        </div>
        <table class="latex-summary-table">
          <thead>
            <tr>
              <th style="width: 15%;">Question #</th>
              <th style="width: 15%;">Type</th>
              <th style="width: 15%;">Marks</th>
              <th style="width: 55%;">Correct Answer</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRowsHtml}
          </tbody>
        </table>
      </section>
    </main>
  </div>
  `;
}

export async function downloadLatexSource(item: CatalogItem): Promise<void> {
  const apiBase = import.meta.env.VITE_API_URL || "";
  const rawName = `${item.course_code}_${item.year}_${item.exam_type}_Solutions`;
  const cleanFilename = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");

  const res = await fetch(`${apiBase}/api/papers/${encodeURIComponent(item.id)}/tex`);
  if (!res.ok) {
    throw new Error("Unable to fetch LaTeX source from backend.");
  }
  const text = await res.text();
  const blob = new Blob([text], { type: "text/x-tex;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cleanFilename}.tex`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadLatexPdf(
  item: CatalogItem,
  onProgress?: (status: string) => void
): Promise<void> {
  const rawName = `${item.course_code}_${item.year}_${item.exam_type}_Solutions`;
  const cleanFilename = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");

  onProgress?.("Compiling authentic LaTeX PDF...");
  const apiBase = import.meta.env.VITE_API_URL || "";
  try {
    const res = await fetch(`${apiBase}/api/papers/${encodeURIComponent(item.id)}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 1000) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanFilename}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    }
  } catch {
  }

  onProgress?.("Fetching exam paper...");
  const paper = await fetchJsonWithFallback<Paper>(item.json_url);
  if (!paper || !paper.questions || paper.questions.length === 0) {
    throw new Error("No readable questions in this question paper.");
  }

  onProgress?.("Loading formulas & diagrams...");
  await preloadPaperAssets(paper);

  onProgress?.("Formatting LaTeX layout with solutions...");
  const htmlContent = buildLatexHtml(paper, item);

  const container = document.createElement("div");
  container.id = "latex-pdf-export-container";
  container.innerHTML = htmlContent;
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.color = "#111111";
  container.style.zIndex = "-9999";
  container.style.opacity = "0.001";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const images = Array.from(container.querySelectorAll("img"));
  if (images.length > 0) {
    await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalHeight > 0) {
              resolve(true);
            } else {
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
            }
          })
      )
    );
  }

  await new Promise((r) => setTimeout(r, 200));

  onProgress?.("Generating and downloading PDF...");

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${cleanFilename}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        const clonedContainer = clonedDoc.getElementById("latex-pdf-export-container");
        if (clonedContainer) {
          clonedContainer.style.position = "static";
          clonedContainer.style.left = "0";
          clonedContainer.style.top = "0";
          clonedContainer.style.opacity = "1";
          clonedContainer.style.zIndex = "1";
          clonedContainer.style.visibility = "visible";
          clonedContainer.style.display = "block";
          clonedContainer.style.margin = "0";
          clonedDoc.body.innerHTML = "";
          clonedDoc.body.appendChild(clonedContainer);
        }
        if (clonedDoc.body) {
          clonedDoc.body.style.backgroundColor = "#ffffff";
          clonedDoc.body.style.color = "#111111";
          clonedDoc.body.style.margin = "0";
          clonedDoc.body.style.padding = "0";
        }
      },
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait" as const,
    },
    pagebreak: {
      mode: ["avoid-all", "css", "legacy"],
      avoid: [
        ".latex-question-card",
        ".latex-passage-box",
        ".latex-options-container",
        ".latex-option-row",
        ".latex-answer-box",
        ".latex-img-block",
        ".latex-summary-section",
      ],
    },
  };

  try {
    const html2pdfModule = await import("html2pdf.js");
    const html2pdf = (html2pdfModule.default || html2pdfModule) as any;
    await html2pdf().set(opt).from(container).save();
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
