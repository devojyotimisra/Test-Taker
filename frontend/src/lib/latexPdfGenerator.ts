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
      result += `<div class="diagram-block"><img src="${escapeHtml(primary)}"${fbAttr} alt="Question Diagram" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" /></div>`;
    } else {
      result += `<img class="diagram-inline" src="${escapeHtml(primary)}"${fbAttr} alt="Formula" crossorigin="anonymous" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" />`;
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
  const courseName = escapeHtml(item.course_name || paper.title || "Examination Paper");
  const courseCode = escapeHtml(item.course_code || "");
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
      const typeLabel = q.type ? escapeHtml(q.type) : "MCQ";

      let passageHtml = "";
      if (q.comprehension_passage && q.comprehension_passage.trim()) {
        passageHtml = `
          <div class="passage-container">
            <div class="passage-label">Comprehension &amp; Reference Material</div>
            <div class="passage-body">${renderPaperText(q.comprehension_passage)}</div>
          </div>
        `;
      }

      let optionsHtml = "";
      if (q.options && q.options.length > 0) {
        optionsHtml = `
          <div class="options-list">
            ${q.options
              .map((opt, optIdx) => {
                const label = String.fromCharCode(65 + optIdx);
                const isCorrect = isOptionCorrect(q, opt);
                return `
                  <div class="option-item ${isCorrect ? "correct-choice" : ""}">
                    <span class="option-label">(${label})</span>
                    <span class="option-text">${renderPaperText(opt)}</span>
                    ${isCorrect ? `<span class="correct-indicator">&#10004; Correct Option</span>` : ""}
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }

      const answerBoxHtml = `
        <div class="solution-box">
          <span class="solution-title">&#10004; Verified Official Key:</span>
          <span class="solution-content">${renderPaperText(formatCorrectAnswerText(q))}</span>
        </div>
      `;

      const sectionDivider =
        q.section_name && (idx === 0 || paper.questions?.[idx - 1]?.section_name !== q.section_name)
          ? `<div class="section-banner">Section: ${escapeHtml(q.section_name)}</div>`
          : "";

      return `
        ${sectionDivider}
        <article class="question-card">
          <div class="q-header-row">
            <div class="q-number-badge">
              <span>Q.${qNum}</span>
              <span class="q-type-tag">${typeLabel}</span>
            </div>
            <div class="q-marks-tag">[${marksLabel}${negLabel}]</div>
          </div>
          ${passageHtml}
          <div class="q-body-text">${renderPaperText(q.text)}</div>
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
          <td style="font-weight: 700; text-align: center;">Q.${qNum}</td>
          <td style="text-align: center;">${escapeHtml(q.type || "MCQ")}</td>
          <td style="text-align: center; font-weight: 600;">${q.marks || 0}</td>
          <td class="correct-val">${renderPaperText(formatCorrectAnswerText(q))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="page-container">
      <header class="masthead-wrapper">
        <div class="masthead-inst">INDIAN INSTITUTE OF TECHNOLOGY MADRAS</div>
        <div class="masthead-dept">BS Degree in Data Science &amp; Applications &bull; Examination Authority</div>
        <div class="masthead-title">${courseName}</div>
        <div class="masthead-subtitle">${courseCode} &bull; ${examType} Solutions &bull; ${term} ${year}</div>

        <table class="metadata-box">
          <tr>
            <td style="width: 25%;">
              <span class="meta-label">Course:</span>
              <span class="meta-val">${courseCode}</span>
            </td>
            <td style="width: 25%;">
              <span class="meta-label">Exam:</span>
              <span class="meta-val">${examType}</span>
            </td>
            <td style="width: 25%;">
              <span class="meta-label">Term / Year:</span>
              <span class="meta-val">${term} ${year}</span>
            </td>
            <td style="width: 25%;">
              <span class="meta-label">Max Marks:</span>
              <span class="meta-val">${totalMarks}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span class="meta-label">Total Qs:</span>
              <span class="meta-val">${totalQuestions}</span>
            </td>
            <td>
              <span class="meta-label">Duration:</span>
              <span class="meta-val">Standard Time</span>
            </td>
            <td colspan="2">
              <span class="meta-label">Status:</span>
              <span class="meta-val" style="color: #047857;">Official Verified Solutions Master</span>
            </td>
          </tr>
        </table>

        <div class="notice-box">
          Standard Academic Protocol &bull; Verified departmental question paper with complete institutional answer keys.
        </div>
      </header>

      <main>
        ${questionsHtml}

        <section class="summary-container">
          <div class="summary-header">
            <h3>Official Answer Key &amp; Mark Distribution Summary</h3>
            <p>Master evaluation rubric for administrative and student assessment verification</p>
          </div>
          <table class="summary-table">
            <thead>
              <tr>
                <th style="width: 14%;">Question #</th>
                <th style="width: 14%;">Type</th>
                <th style="width: 14%;">Marks</th>
                <th style="width: 58%; text-align: left; padding-left: 10px;">Official Verified Key</th>
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

export async function downloadPaperPdf(
  item: CatalogItem,
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.("Loading question paper...");
  const paper = await fetchJsonWithFallback<Paper>(item.json_url);
  if (!paper || !paper.questions || paper.questions.length === 0) {
    throw new Error("No readable questions in this question paper.");
  }

  onProgress?.("Loading formulas & diagrams...");
  await preloadPaperAssets(paper);

  onProgress?.("Formatting document...");
  const rawName = `${item.course_code}_${item.year}_${item.exam_type}_Solutions`;
  const cleanFilename = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  const paperHtml = buildPaperHtml(paper, item);

  const container = document.createElement("div");
  container.id = "print-paper-render-root";
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#111827";
  container.style.zIndex = "-99999";
  container.style.opacity = "0.001";
  container.style.pointerEvents = "none";

  container.innerHTML = `
    <style id="paper-pdf-dedicated-styles">
      #print-paper-render-root, #print-paper-render-root * {
        box-sizing: border-box;
      }
      #print-paper-render-root {
        background-color: #ffffff !important;
        color: #111827 !important;
        font-family: "Times New Roman", Times, "Nimbus Roman", "Liberation Serif", Georgia, serif !important;
        font-size: 10.5pt !important;
        line-height: 1.5 !important;
      }
      .page-container {
        width: 794px;
        margin: 0 auto;
        padding: 16mm 14mm 18mm 14mm;
        background-color: #ffffff !important;
      }
      .masthead-wrapper {
        text-align: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 2.5px solid #1e3a8a;
      }
      .masthead-inst {
        font-size: 14.5pt;
        font-weight: 700;
        letter-spacing: 1.2px;
        color: #0f172a !important;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .masthead-dept {
        font-size: 8.5pt;
        font-weight: 600;
        letter-spacing: 0.8px;
        color: #475569 !important;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .masthead-title {
        font-size: 13.5pt;
        font-weight: 700;
        color: #1e3a8a !important;
        margin-bottom: 3px;
      }
      .masthead-subtitle {
        font-size: 10pt;
        font-style: italic;
        color: #334155 !important;
        margin-bottom: 8px;
      }
      .metadata-box {
        width: 100%;
        border-collapse: collapse;
        background-color: #f8fafc !important;
        border: 1px solid #cbd5e1;
        border-left: 3.5px solid #1e3a8a;
        margin-top: 6px;
        margin-bottom: 8px;
      }
      .metadata-box td {
        padding: 5px 8px;
        font-size: 9pt;
        vertical-align: middle;
        border: 1px solid #e2e8f0;
        color: #0f172a !important;
      }
      .meta-label {
        font-weight: 700;
        color: #1e3a8a !important;
        margin-right: 4px;
        text-transform: uppercase;
        font-size: 8pt;
        letter-spacing: 0.4px;
      }
      .meta-val {
        color: #0f172a !important;
        font-weight: 600;
      }
      .notice-box {
        background-color: #f1f5f9 !important;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 8pt;
        color: #475569 !important;
        font-style: italic;
        text-align: center;
        margin-bottom: 14px;
      }
      .section-banner {
        font-size: 11pt;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: #1e3a8a !important;
        background-color: #f1f5f9 !important;
        border-left: 3.5px solid #1e3a8a;
        padding: 5px 10px;
        margin: 18px 0 12px 0;
      }
      .question-card {
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      .q-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        padding-bottom: 3px;
        border-bottom: 1px dashed #cbd5e1;
      }
      .q-number-badge {
        font-size: 11pt;
        font-weight: 700;
        color: #0f172a !important;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .q-type-tag {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        background-color: #f1f5f9 !important;
        color: #475569 !important;
        border: 1px solid #cbd5e1;
        padding: 1px 5px;
        border-radius: 3px;
      }
      .q-marks-tag {
        font-size: 8.5pt;
        font-weight: 700;
        color: #0369a1 !important;
        background-color: #f0f9ff !important;
        border: 1px solid #bae6fd;
        padding: 1px 6px;
        border-radius: 3px;
      }
      .passage-container {
        background-color: #f8fafc !important;
        border: 1px solid #cbd5e1;
        border-left: 3.5px solid #64748b;
        border-radius: 0 4px 4px 0;
        padding: 6px 10px;
        margin: 6px 0 10px 0;
      }
      .passage-label {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #475569 !important;
        margin-bottom: 3px;
      }
      .passage-body {
        font-size: 9.5pt;
        line-height: 1.4;
        color: #1e293b !important;
      }
      .q-body-text {
        font-size: 10.5pt;
        line-height: 1.45;
        color: #111827 !important;
        margin-bottom: 8px;
      }
      .options-list {
        margin-left: 4px;
        margin-top: 6px;
        margin-bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .option-item {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 10pt;
        line-height: 1.4;
        background-color: #ffffff !important;
        border: 1px solid transparent;
        color: #111827 !important;
      }
      .option-item.correct-choice {
        background-color: #ecfdf5 !important;
        border-color: #a7f3d0 !important;
        color: #065f46 !important;
        font-weight: 600;
      }
      .option-label {
        font-weight: 700;
        color: #1e3a8a !important;
        min-width: 22px;
        font-size: 10pt;
      }
      .option-item.correct-choice .option-label {
        color: #047857 !important;
      }
      .option-text {
        flex: 1;
        color: inherit !important;
      }
      .correct-indicator {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        background-color: #d1fae5 !important;
        color: #047857 !important;
        border: 1px solid #6ee7b7;
        padding: 1px 6px;
        border-radius: 9999px;
        margin-left: 6px;
        letter-spacing: 0.3px;
      }
      .solution-box {
        margin-top: 6px;
        padding: 5px 10px;
        background-color: #f0fdf4 !important;
        border: 1px solid #bbf7d0;
        border-left: 3.5px solid #16a34a;
        border-radius: 0 4px 4px 0;
        font-size: 9.5pt;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .solution-title {
        font-weight: 700;
        color: #15803d !important;
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        white-space: nowrap;
      }
      .solution-content {
        color: #166534 !important;
        font-weight: 600;
      }
      .summary-container {
        margin-top: 24px;
        padding-top: 14px;
        border-top: 2.5px solid #1e3a8a;
      }
      .summary-header {
        text-align: center;
        margin-bottom: 10px;
      }
      .summary-header h3 {
        font-size: 12pt;
        font-weight: 700;
        color: #0f172a !important;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }
      .summary-header p {
        font-size: 8pt;
        color: #64748b !important;
        font-style: italic;
        margin-top: 2px;
      }
      .summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
        background-color: #ffffff !important;
      }
      .summary-table th {
        background-color: #1e3a8a !important;
        color: #ffffff !important;
        font-weight: 700;
        padding: 5px 6px;
        text-align: center;
        border: 1px solid #1e3a8a;
        text-transform: uppercase;
        font-size: 7.5pt;
        letter-spacing: 0.4px;
      }
      .summary-table td {
        padding: 4px 6px;
        border: 1px solid #cbd5e1;
        color: #1e293b !important;
        background-color: #ffffff !important;
      }
      .summary-table tr:nth-child(even) td {
        background-color: #f8fafc !important;
      }
      .summary-table td.correct-val {
        color: #047857 !important;
        font-weight: 600;
      }
      .diagram-block {
        text-align: center;
        margin: 8px 0;
      }
      .diagram-block img {
        max-width: 88%;
        max-height: 280px;
        height: auto;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px;
        background-color: #ffffff !important;
        display: inline-block;
      }
      .diagram-inline {
        vertical-align: middle;
        max-height: 1.4em;
        border-radius: 2px;
      }
    </style>
    ${paperHtml}
  `;

  document.body.appendChild(container);

  try {
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

    await new Promise((r) => setTimeout(r, 150));

    onProgress?.("Rendering pages...");
    const [html2canvasModule, jsPdfModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const html2canvas = html2canvasModule.default || html2canvasModule;
    const { jsPDF } = jsPdfModule;

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        clonedDoc.documentElement.classList.remove("dark");
        clonedDoc.documentElement.removeAttribute("class");
        clonedDoc.documentElement.style.backgroundColor = "#ffffff";
        clonedDoc.documentElement.style.color = "#111827";
        if (clonedDoc.body) {
          clonedDoc.body.classList.remove("dark");
          clonedDoc.body.removeAttribute("class");
          clonedDoc.body.style.backgroundColor = "#ffffff";
          clonedDoc.body.style.color = "#111827";
          clonedDoc.body.style.margin = "0";
          clonedDoc.body.style.padding = "0";
        }
        const clonedTarget = clonedDoc.getElementById("print-paper-render-root");
        if (clonedTarget) {
          clonedTarget.style.position = "static";
          clonedTarget.style.opacity = "1";
          clonedTarget.style.zIndex = "1";
          clonedTarget.style.backgroundColor = "#ffffff";
          clonedTarget.style.color = "#111827";
          clonedTarget.style.width = "794px";
          clonedDoc.body.innerHTML = "";
          clonedDoc.body.appendChild(clonedTarget);
        }
      },
    });

    onProgress?.("Compiling PDF document...");
    const a4Aspect = 297 / 210;
    const pageHeightPx = Math.floor(canvas.width * a4Aspect);
    const containerRect = container.getBoundingClientRect();
    const cardElements = Array.from(
      container.querySelectorAll(".question-card, .passage-container, .summary-container, .masthead-wrapper")
    );
    const cardTops = cardElements.map((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round((rect.top - containerRect.top) * 2);
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    let currentY = 0;
    let pageIndex = 0;

    while (currentY < canvas.height) {
      let sliceHeight = pageHeightPx;
      if (currentY + sliceHeight < canvas.height) {
        const splitThreshold = currentY + sliceHeight;
        const candidateCut = cardTops
          .filter((top) => top > currentY + pageHeightPx * 0.72 && top <= splitThreshold)
          .pop();
        if (candidateCut && candidateCut > currentY + 400) {
          sliceHeight = candidateCut - currentY;
        }
      } else {
        sliceHeight = canvas.height - currentY;
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageHeightPx;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          currentY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
      }

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (pageIndex > 0) {
        pdf.addPage([210, 297], "portrait");
      }
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

      currentY += sliceHeight;
      pageIndex++;
    }

    pdf.save(`${cleanFilename}.pdf`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export const downloadLatexPdf = downloadPaperPdf;
