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

function renderPaperText(text: string | null | undefined): string {
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
        raw.toLowerCase().endsWith(".jpeg") ||
        raw.toLowerCase().endsWith(".webp");
    }

    const { primary, fallback } = resolveImageSource(src);
    const fbAttr = fallback && fallback !== primary ? ` data-fallback="${escapeHtml(fallback)}"` : "";

    if (isBlock) {
      result += `<div class="paper-img-block"><img src="${escapeHtml(primary)}"${fbAttr} alt="Diagram" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" /></div>`;
    } else {
      result += `<img class="paper-img-inline" src="${escapeHtml(primary)}"${fbAttr} alt="Formula" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" />`;
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
    return "Not specified in official key";
  }

  if (Array.isArray(q.correct_answer)) {
    const parts = q.correct_answer.map((ans) => {
      const letter = getOptionLetter(q.options, String(ans));
      return letter ? `(${letter}) ${String(ans)}` : String(ans);
    });
    return parts.join(", ");
  }

  if (q.options && q.options.length > 0) {
    const letter = getOptionLetter(q.options, String(q.correct_answer));
    if (letter) {
      return `(${letter}) ${String(q.correct_answer)}`;
    }
  }

  return String(q.correct_answer);
}

function buildPaperHtml(paper: Paper, item: CatalogItem): string {
  const title = escapeHtml(item.course_name || paper.title || "Examination Paper");
  const code = escapeHtml(item.course_code || "");
  const term = escapeHtml(item.term || "");
  const year = escapeHtml(String(item.year || ""));
  const examType = escapeHtml(item.exam_type || "Term Examination");
  const totalMarks = paper.total_marks || item.total_marks || 0;
  const totalQuestions = paper.questions?.length || paper.total_questions || item.total_questions || 0;

  const questionsHtml = (paper.questions || [])
    .map((q: Question, idx: number) => {
      const qNum = q.number || idx + 1;
      const marksLabel = `${q.marks || 0} Mark${q.marks === 1 ? "" : "s"}`;
      const negLabel = q.negative_marks ? `, -${q.negative_marks}` : "";
      const typeLabel = q.type ? `[${escapeHtml(q.type)}]` : "";

      let passageHtml = "";
      if (q.comprehension_passage && q.comprehension_passage.trim()) {
        passageHtml = `
          <div class="paper-passage-box">
            <div class="paper-passage-title">Comprehension / Reference Data:</div>
            <div class="paper-passage-body">${renderPaperText(q.comprehension_passage)}</div>
          </div>
        `;
      }

      let optionsHtml = "";
      if (q.options && q.options.length > 0) {
        optionsHtml = `
          <div class="paper-options-container">
            ${q.options
              .map((opt, optIdx) => {
                const label = String.fromCharCode(65 + optIdx);
                const isCorrect = isOptionCorrect(q, opt);
                return `
                  <div class="paper-option-row">
                    <span class="paper-option-letter">(${label})</span>
                    <span class="paper-option-content">${renderPaperText(opt)} ${
                      isCorrect ? `<strong>[Correct]</strong>` : ""
                    }</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }

      const answerBoxHtml = `
        <div class="paper-answer-box">
          <span>Correct Answer: ${renderPaperText(formatCorrectAnswerText(q))}</span>
        </div>
      `;

      const sectionDivider =
        q.section_name && (idx === 0 || paper.questions?.[idx - 1]?.section_name !== q.section_name)
          ? `<div class="paper-section-divider">Section: ${escapeHtml(q.section_name)}</div>`
          : "";

      return `
        ${sectionDivider}
        <article class="paper-question-card">
          <div class="paper-q-header">
            <span class="paper-q-title">Q.${qNum} ${typeLabel}</span>
            <span class="paper-q-meta">[${marksLabel}${negLabel}]</span>
          </div>
          ${passageHtml}
          <div class="paper-q-body">${renderPaperText(q.text)}</div>
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
          <td>${renderPaperText(formatCorrectAnswerText(q))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <header class="paper-header">
      <div class="paper-inst">INDIAN INSTITUTE OF TECHNOLOGY MADRAS</div>
      <div class="paper-degree">BS Degree in Data Science and Applications</div>
      <div class="paper-title">${title}</div>
      <table class="paper-meta-table">
        <tr>
          <td style="width: 33%;"><strong>Course Code:</strong> ${code}</td>
          <td style="width: 34%; text-align: center;"><strong>Exam:</strong> ${examType}</td>
          <td style="width: 33%; text-align: right;"><strong>Total Marks:</strong> ${totalMarks}</td>
        </tr>
        <tr>
          <td><strong>Term / Year:</strong> ${term} ${year}</td>
          <td style="text-align: center;"><strong>Questions:</strong> ${totalQuestions}</td>
          <td style="text-align: right;"><strong>Status:</strong> Solutions Paper</td>
        </tr>
      </table>
    </header>
    <main>
      ${questionsHtml}
      <section class="paper-summary-section">
        <div class="paper-summary-title">ANSWER KEY SUMMARY</div>
        <table class="paper-summary-table">
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
  `;
}

export async function downloadPaperPdf(
  item: CatalogItem,
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.("Loading question paper...");
  const paper = await fetchJsonWithFallback<Paper>(item.json_url);
  if (!paper || !paper.questions || paper.questions.length === 0) {
    throw new Error("No readable questions in this question paper.");
  }

  onProgress?.("Preloading question diagrams...");
  await preloadPaperAssets(paper);

  onProgress?.("Rendering document...");
  const rawName = `${item.course_code}_${item.year}_${item.exam_type}_Solutions`;
  const cleanFilename = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  const paperHtml = buildPaperHtml(paper, item);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "794px";
  iframe.style.height = "1000px";
  iframe.style.opacity = "0.001";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-99999";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error("Unable to create printing context.");
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(cleanFilename)}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: "Times New Roman", Times, Georgia, serif;
              font-size: 11pt;
              line-height: 1.45;
              color: #000000;
              background-color: #ffffff;
              padding: 18mm 14mm;
              width: 794px;
            }
            .paper-header {
              text-align: center;
              margin-bottom: 12px;
              border-bottom: 2px solid #000000;
              padding-bottom: 8px;
            }
            .paper-inst {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .paper-degree {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 6px;
            }
            .paper-title {
              font-size: 13pt;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .paper-meta-table {
              width: 100%;
              margin: 8px 0;
              border-top: 1px solid #000000;
              border-bottom: 1px solid #000000;
              padding: 6px 0;
              font-size: 10pt;
              border-collapse: collapse;
            }
            .paper-meta-table td {
              padding: 3px 6px;
              vertical-align: top;
            }
            .paper-section-divider {
              font-size: 12pt;
              font-weight: bold;
              text-transform: uppercase;
              border-bottom: 1.5px solid #000000;
              padding-bottom: 4px;
              margin: 22px 0 12px 0;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-question-card {
              margin-bottom: 14px;
              padding-bottom: 10px;
              border-bottom: 1px dotted #888888;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-q-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              margin-bottom: 6px;
              font-weight: bold;
            }
            .paper-q-title {
              font-size: 11.5pt;
            }
            .paper-q-meta {
              font-size: 9.5pt;
            }
            .paper-passage-box {
              border: 1px solid #000000;
              padding: 8px 10px;
              margin: 8px 0 10px 0;
              font-size: 10pt;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-passage-title {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 8.5pt;
              margin-bottom: 4px;
            }
            .paper-passage-body {
              line-height: 1.4;
            }
            .paper-q-body {
              font-size: 11pt;
              line-height: 1.45;
              margin-bottom: 8px;
            }
            .paper-options-container {
              margin-left: 12px;
              margin-top: 6px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-option-row {
              display: flex;
              align-items: baseline;
              gap: 8px;
              margin-bottom: 4px;
              font-size: 10.5pt;
              line-height: 1.4;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-option-letter {
              font-weight: bold;
              min-width: 22px;
            }
            .paper-option-content {
              flex: 1;
            }
            .paper-answer-box {
              margin-top: 8px;
              padding: 4px 8px;
              border: 1px solid #000000;
              font-size: 10pt;
              font-weight: bold;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-summary-section {
              margin-top: 24px;
              padding-top: 12px;
              border-top: 2px solid #000000;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-summary-title {
              font-size: 12pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 10px;
            }
            .paper-summary-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5pt;
            }
            .paper-summary-table th, .paper-summary-table td {
              border: 1px solid #000000;
              padding: 4px 6px;
            }
            .paper-summary-table th {
              text-align: center;
              font-weight: bold;
            }
            .paper-img-block {
              text-align: center;
              margin: 8px 0;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .paper-img-block img {
              max-width: 90%;
              max-height: 280px;
              height: auto;
              display: inline-block;
            }
            .paper-img-inline {
              vertical-align: middle;
              max-height: 1.4em;
            }
          </style>
        </head>
        <body>
          ${paperHtml}
        </body>
      </html>
    `);
    doc.close();

    const images = Array.from(doc.querySelectorAll("img"));
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

    await new Promise((r) => setTimeout(r, 150));

    onProgress?.("Downloading PDF...");
    const html2pdfModule = await import("html2pdf.js");
    const html2pdf = (html2pdfModule.default || html2pdfModule) as any;

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
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait" as const,
      },
      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
        avoid: [
          ".paper-question-card",
          ".paper-passage-box",
          ".paper-options-container",
          ".paper-option-row",
          ".paper-answer-box",
          ".paper-img-block",
          ".paper-summary-section",
        ],
      },
    };

    await html2pdf().set(opt).from(doc.body).save();
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

export const downloadLatexPdf = downloadPaperPdf;
