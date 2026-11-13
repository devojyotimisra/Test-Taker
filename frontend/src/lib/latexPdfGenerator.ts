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
      result += `<div class="latex-img-block"><img src="${escapeHtml(primary)}"${fbAttr} alt="Diagram" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" /></div>`;
    } else {
      result += `<img class="latex-img-inline" src="${escapeHtml(primary)}"${fbAttr} alt="Formula" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}" />`;
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }

  return result.replace(/\n/g, "<br />");
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
                return `
                  <div class="latex-option-row">
                    <span class="latex-option-letter">(${label})</span>
                    <span class="latex-option-content">${renderLatexText(opt)}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }

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
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${code}_${year}_${examType}_Paper</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Latin Modern Roman", "Computer Modern Roman", "Times New Roman", Times, Georgia, serif;
      font-size: 10.5pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    .latex-doc {
      max-width: 100%;
      margin: 0 auto;
    }
    .latex-header {
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #111;
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
      color: #333;
      margin-bottom: 6px;
    }
    .latex-meta-table {
      width: 100%;
      margin: 6px 0;
      border-top: 1px solid #222;
      border-bottom: 1px solid #222;
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
      color: #444;
      line-height: 1.35;
      margin-top: 6px;
    }
    .latex-instructions ul {
      margin: 3px 0 0 16px;
      padding: 0;
    }
    .latex-section-divider {
      break-after: avoid;
      page-break-after: avoid;
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1.5px solid #222;
      padding-bottom: 4px;
      margin: 20px 0 12px 0;
    }
    .latex-question-card {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px dotted #ccc;
    }
    .latex-q-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
      break-after: avoid;
      page-break-after: avoid;
    }
    .latex-q-title {
      font-weight: 700;
      font-size: 11pt;
    }
    .latex-q-meta {
      font-size: 9pt;
      color: #333;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .latex-type-badge {
      font-family: "Courier New", Courier, monospace;
      font-size: 8pt;
      font-weight: 700;
      padding: 1px 4px;
      border: 1px solid #888;
      border-radius: 3px;
      background: #f4f4f4;
    }
    .latex-marks-badge {
      font-weight: 600;
    }
    .latex-passage-box {
      break-inside: avoid;
      page-break-inside: avoid;
      background: #f9f9f9;
      border-left: 3px solid #222;
      padding: 6px 10px;
      margin: 6px 0 10px 0;
      font-size: 9.5pt;
    }
    .latex-passage-title {
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      color: #555;
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
      break-inside: avoid;
      page-break-inside: avoid;
      margin-left: 10px;
      margin-top: 6px;
    }
    .latex-option-row {
      break-inside: avoid;
      page-break-inside: avoid;
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 10pt;
      line-height: 1.4;
    }
    .latex-option-letter {
      font-weight: 700;
      min-width: 20px;
      color: #222;
    }
    .latex-option-content {
      flex: 1;
    }
    .latex-img-block {
      break-inside: avoid;
      text-align: center;
      margin: 8px 0;
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
      background: #fff;
    }
    @media print {
      body {
        background: transparent;
      }
      .latex-question-card {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .latex-options-container {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .latex-option-row {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .latex-passage-box {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="latex-doc">
    <header class="latex-header">
      <div class="latex-inst">Indian Institute of Technology Madras</div>
      <div class="latex-degree">BS Degree Programme &bull; Official Assessment Paper</div>
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
        <strong>INSTRUCTIONS:</strong>
        <ul>
          <li>All questions carry the indicated marks. Verify that each question and formula renders clearly.</li>
          <li>Negative marks are deducted for incorrect answers where specified.</li>
          <li>TCS iON Scientific Calculator is permitted for computation as per institute policy.</li>
        </ul>
      </div>
    </header>
    <main>
      ${questionsHtml}
    </main>
  </div>
</body>
</html>`;
}

export async function generateAndPrintLatexPdf(
  item: CatalogItem,
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.("Fetching exam paper...");
  const paper = await fetchJsonWithFallback<Paper>(item.json_url);
  if (!paper || !paper.questions || paper.questions.length === 0) {
    throw new Error("No readable questions in this question paper.");
  }

  onProgress?.("Loading formulas & diagrams...");
  await preloadPaperAssets(paper);

  onProgress?.("Rendering LaTeX layout...");
  const htmlContent = buildLatexHtml(paper, item);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Could not initialize printing engine.");
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  const iframeImages = Array.from(iframeDoc.images);
  if (iframeImages.length > 0) {
    await Promise.all(
      iframeImages.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
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

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    throw new Error("Print window not available.");
  }

  win.focus();
  win.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 15000);
}

