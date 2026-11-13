import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
  type DocumentProps,
} from "@react-pdf/renderer";
import { CatalogItem, Paper, Question } from "../types";
import { fetchJsonWithFallback, resolveImageSource } from "./assetService";

interface ImageAsset {
  dataUrl: string;
  width: number;
  height: number;
}

interface ContentSegment {
  type: "text" | "image";
  value: string;
  isBlock: boolean;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 45,
    paddingLeft: 36,
    paddingRight: 36,
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  runningHeader: {
    position: "absolute",
    top: 15,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
  },
  runningHeaderTextLeft: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
    letterSpacing: 0.3,
  },
  runningHeaderTextRight: {
    fontSize: 7,
    fontFamily: "Helvetica",
    color: "#64748b",
  },
  runningFooter: {
    position: "absolute",
    bottom: 15,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 4,
  },
  runningFooterTextLeft: {
    fontSize: 7,
    fontFamily: "Helvetica",
    color: "#64748b",
  },
  runningFooterTextCenter: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    letterSpacing: 1,
  },
  runningFooterTextRight: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
  },
  coverTopBar: {
    height: 4,
    backgroundColor: "#1e3a8a",
    marginBottom: 2,
    borderRadius: 1,
  },
  coverSubBar: {
    height: 1.5,
    backgroundColor: "#0284c7",
    marginBottom: 12,
    borderRadius: 1,
  },
  instBanner: {
    textAlign: "center",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  mainTitle: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Times-Bold",
    color: "#1e3a8a",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  courseTitle: {
    textAlign: "center",
    fontSize: 10.5,
    fontFamily: "Times-Bold",
    color: "#334155",
    marginBottom: 12,
  },
  metaGrid: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  metaCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.8,
    borderRightColor: "#cbd5e1",
    alignItems: "center",
  },
  metaCellLast: {
    flex: 1,
    padding: 6,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "center",
  },
  instructBox: {
    backgroundColor: "#f8fafc",
    borderLeftWidth: 3,
    borderLeftColor: "#1e3a8a",
    borderWidth: 0.8,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 8,
    marginBottom: 14,
  },
  instructTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  instructText: {
    fontSize: 7.5,
    fontFamily: "Times-Roman",
    color: "#334155",
    lineHeight: 1.35,
    marginBottom: 2,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#1e3a8a",
    borderRadius: 3,
  },
  sectionDividerText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  questionCard: {
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 4,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  qBadge: {
    backgroundColor: "#1e3a8a",
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginRight: 6,
  },
  typeBadgeMcq: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  typeBadgeMsq: {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  typeBadgeNat: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  marksBadge: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  negativeBadge: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginLeft: 4,
  },
  passageBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    padding: 7,
    marginBottom: 8,
  },
  passageHeader: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  passageText: {
    fontSize: 8.5,
    fontFamily: "Times-Italic",
    color: "#334155",
    lineHeight: 1.35,
  },
  questionText: {
    fontSize: 9.5,
    fontFamily: "Times-Roman",
    lineHeight: 1.45,
    color: "#0f172a",
    marginBottom: 8,
  },
  diagramBlockContainer: {
    marginVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    padding: 4,
  },
  optionList: {
    marginTop: 4,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    marginBottom: 4,
    borderRadius: 3,
    borderWidth: 0.8,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  optionRowCorrect: {
    backgroundColor: "#f0fdf4",
    borderColor: "#16a34a",
    borderWidth: 1.2,
  },
  optLetterCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginRight: 6,
    paddingTop: 1.5,
  },
  optLetterCircleCorrect: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 9,
    fontFamily: "Times-Roman",
    color: "#1e293b",
    lineHeight: 1.35,
  },
  optionTextCorrect: {
    color: "#14532d",
    fontFamily: "Times-Bold",
  },
  correctTag: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginLeft: 6,
  },
  answerCallout: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#f0fdf4",
    borderLeftWidth: 2.5,
    borderLeftColor: "#16a34a",
    borderWidth: 0.5,
    borderColor: "#dcfce7",
    borderRadius: 2,
  },
  answerCalloutTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#15803d",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  answerCalloutText: {
    fontSize: 8.5,
    fontFamily: "Times-Bold",
    color: "#14532d",
    lineHeight: 1.35,
  },
  tableContainer: {
    marginTop: 10,
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a8a",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  tableCellText: {
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  tableCellTextBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  endNotice: {
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Times-BoldItalic",
    color: "#64748b",
    marginTop: 14,
    marginBottom: 8,
  },
  missingImageBox: {
    padding: 4,
    backgroundColor: "#f1f5f9",
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    alignItems: "center",
  },
  missingImageText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Oblique",
    color: "#64748b",
  },
});

function cleanBasename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function cleanTextString(str: string): string {
  return str.replace(/\[IMAGE:\s*([^\]|]+)(?:\|[^\]]+)?\]/g, "[Diagram: $1]");
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
    return "Official key pending evaluation";
  }

  if (Array.isArray(q.correct_answer)) {
    const parts = q.correct_answer.map((ans) => {
      const letter = getOptionLetter(q.options, String(ans));
      const clean = cleanTextString(String(ans));
      return letter ? `Option (${letter}): ${clean}` : clean;
    });
    return parts.join("  |  ");
  }

  if (q.options && q.options.length > 0) {
    const letter = getOptionLetter(q.options, String(q.correct_answer));
    const clean = cleanTextString(String(q.correct_answer));
    if (letter) {
      return `Option (${letter}): ${clean}`;
    }
  }

  return cleanTextString(String(q.correct_answer));
}

function parseContentSegments(rawText: string | null | undefined): ContentSegment[] {
  if (!rawText) return [];
  const segments: ContentSegment[] = [];
  const regex = /\[IMAGE:\s*([^\]]+)\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      const text = rawText.slice(lastIdx, match.index).trim();
      if (text) {
        segments.push({ type: "text", value: text, isBlock: false });
      }
    }

    const rawParam = match[1].trim();
    let src = rawParam;
    let isBlock = false;
    if (rawParam.includes("|")) {
      const parts = rawParam.split("|");
      src = parts[0].trim();
      isBlock = parts[1]?.trim().toLowerCase() === "block";
    } else {
      isBlock =
        rawParam.toLowerCase().endsWith(".jpg") ||
        rawParam.toLowerCase().endsWith(".jpeg") ||
        rawParam.toLowerCase().endsWith(".webp") ||
        rawParam.toLowerCase().endsWith(".png");
    }

    segments.push({ type: "image", value: src, isBlock });
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < rawText.length) {
    const text = rawText.slice(lastIdx).trim();
    if (text) {
      segments.push({ type: "text", value: text, isBlock: false });
    }
  }

  return segments;
}

async function loadAndConvertImage(src: string): Promise<ImageAsset | null> {
  if (typeof window === "undefined") return null;
  const { primary, fallback } = resolveImageSource(src);

  const tryLoad = (url: string): Promise<ImageAsset> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const naturalW = img.naturalWidth || img.width || 400;
          const naturalH = img.naturalHeight || img.height || 200;
          const canvas = document.createElement("canvas");
          canvas.width = naturalW;
          canvas.height = naturalH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context creation failed"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");

          const maxW = 460;
          const maxH = 220;
          let w = naturalW;
          let h = naturalH;
          if (w > maxW) {
            const ratio = maxW / w;
            w = maxW;
            h = h * ratio;
          }
          if (h > maxH) {
            const ratio = maxH / h;
            h = maxH;
            w = w * ratio;
          }

          resolve({
            dataUrl,
            width: Math.max(30, Math.round(w)),
            height: Math.max(20, Math.round(h)),
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });
  };

  try {
    return await tryLoad(primary);
  } catch {
    if (fallback && fallback !== primary) {
      try {
        return await tryLoad(fallback);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function preloadAllPaperImages(
  paper: Paper,
  onProgress?: (msg: string) => void
): Promise<Map<string, ImageAsset>> {
  const imageMap = new Map<string, ImageAsset>();
  const urls = new Set<string>();

  for (const q of paper.questions || []) {
    for (const img of q.images || []) {
      if (img) urls.add(img);
    }
    for (const seg of parseContentSegments(q.text)) {
      if (seg.type === "image") urls.add(seg.value);
    }
    for (const opt of q.options || []) {
      for (const seg of parseContentSegments(opt)) {
        if (seg.type === "image") urls.add(seg.value);
      }
    }
    if (q.comprehension_passage) {
      for (const seg of parseContentSegments(q.comprehension_passage)) {
        if (seg.type === "image") urls.add(seg.value);
      }
    }
  }

  const list = Array.from(urls);
  let loadedCount = 0;
  for (const src of list) {
    if (onProgress) {
      onProgress(`Rendering visual assets (${loadedCount + 1}/${list.length})...`);
    }
    const asset = await loadAndConvertImage(src);
    if (asset) {
      imageMap.set(src, asset);
    }
    loadedCount++;
  }

  return imageMap;
}

function renderContentElements(
  segments: ContentSegment[],
  imageMap: Map<string, ImageAsset>,
  textStyle: any
): React.ReactElement[] {
  return segments.map((seg, idx) => {
    if (seg.type === "text") {
      return React.createElement(Text, { key: idx, style: textStyle }, seg.value);
    }
    const asset = imageMap.get(seg.value);
    if (asset) {
      return React.createElement(
        View,
        { key: idx, style: styles.diagramBlockContainer },
        React.createElement(Image, {
          src: asset.dataUrl,
          style: {
            width: asset.width,
            height: asset.height,
            objectFit: "contain",
          },
        })
      );
    }
    return React.createElement(
      View,
      { key: idx, style: styles.missingImageBox },
      React.createElement(
        Text,
        { style: styles.missingImageText },
        `[Figure: ${cleanBasename(seg.value)}]`
      )
    );
  });
}

function resolveCatalogItem(paper: Paper, catalogItem?: CatalogItem): CatalogItem {
  if (catalogItem) return catalogItem;
  const nameBase = paper.filename.replace(/\.pdf$/i, "").replace(/\.json$/i, "");
  const parts = nameBase.split("_");
  const code = parts[0]?.toUpperCase() || "EXAM";
  const year = parseInt(parts[1]?.slice(0, 4) || "2025", 10);
  return {
    id: nameBase,
    filename: paper.filename,
    json_file: `${nameBase}.json`,
    title: paper.title,
    course_code: code,
    course_name: paper.title,
    level: "Degree Level",
    year: isNaN(year) ? 2025 : year,
    term: "Term 3",
    term_code: "2025T3",
    exam_type: "End Term",
    session: "Afternoon",
    total_questions: paper.total_questions || paper.questions?.length || 0,
    total_marks: paper.total_marks || 100,
    json_url: `/data/papers/${nameBase}.json`,
  };
}

function buildPaperDocument(
  paper: Paper,
  item: CatalogItem,
  imageMap: Map<string, ImageAsset>
): React.ReactElement {
  const questions = paper.questions || [];

  const questionElements = questions.map((q, idx) => {
    const isMsq = q.type === "multichoice";
    const isNat = q.type === "numeric";
    const typeLabel = isMsq
      ? "Multiple Select (MSQ)"
      : isNat
      ? "Numerical Answer (NAT)"
      : "Multiple Choice (MCQ)";
    const typeBadgeStyle = isMsq
      ? styles.typeBadgeMsq
      : isNat
      ? styles.typeBadgeNat
      : styles.typeBadgeMcq;

    const textSegments = parseContentSegments(q.text);
    const renderedBody = renderContentElements(textSegments, imageMap, styles.questionText);

    const optionElements =
      q.options && q.options.length > 0
        ? React.createElement(
            View,
            { style: styles.optionList },
            q.options.map((opt, oIdx) => {
              const correct = isOptionCorrect(q, opt);
              const optLetter = String.fromCharCode(65 + oIdx);
              const optSegments = parseContentSegments(opt);
              const renderedOpt = renderContentElements(
                optSegments,
                imageMap,
                correct ? styles.optionTextCorrect : styles.optionText
              );

              return React.createElement(
                View,
                {
                  key: oIdx,
                  style: [styles.optionRow, correct ? styles.optionRowCorrect : undefined],
                },
                React.createElement(
                  Text,
                  {
                    style: [
                      styles.optLetterCircle,
                      correct ? styles.optLetterCircleCorrect : undefined,
                    ],
                  },
                  optLetter
                ),
                React.createElement(View, { style: styles.optionContent }, ...renderedOpt),
                correct ? React.createElement(Text, { style: styles.correctTag }, "VERIFIED KEY") : null
              );
            })
          )
        : null;

    const passageElement = q.comprehension_passage
      ? React.createElement(
          View,
          { style: styles.passageBox },
          React.createElement(
            Text,
            { style: styles.passageHeader },
            "COMPREHENSION PASSAGE / CONTEXT REFERENCE"
          ),
          ...renderContentElements(
            parseContentSegments(q.comprehension_passage),
            imageMap,
            styles.passageText
          )
        )
      : null;

    return React.createElement(
      View,
      { key: idx, style: styles.questionCard, wrap: false },
      React.createElement(
        View,
        { style: styles.cardHeader },
        React.createElement(
          View,
          { style: styles.cardHeaderLeft },
          React.createElement(
            Text,
            { style: styles.qBadge },
            `QUESTION ${String(q.number).padStart(2, "0")}`
          ),
          React.createElement(Text, { style: typeBadgeStyle }, typeLabel)
        ),
        React.createElement(
          View,
          { style: styles.cardHeaderRight },
          React.createElement(
            Text,
            { style: styles.marksBadge },
            `+${q.marks.toFixed(1)} Marks`
          ),
          q.negative_marks > 0
            ? React.createElement(
                Text,
                { style: styles.negativeBadge },
                `-${q.negative_marks.toFixed(1)} Neg`
              )
            : null
        )
      ),
      passageElement,
      ...renderedBody,
      optionElements,
      React.createElement(
        View,
        { style: styles.answerCallout },
        React.createElement(
          Text,
          { style: styles.answerCalloutTitle },
          "OFFICIAL ANSWER KEY & RATIONALE"
        ),
        React.createElement(
          Text,
          { style: styles.answerCalloutText },
          formatCorrectAnswerText(q)
        )
      )
    );
  });

  const matrixRows = questions.map((q, idx) => {
    return React.createElement(
      View,
      {
        key: idx,
        style: [styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : undefined],
        wrap: false,
      },
      React.createElement(
        View,
        { style: { width: "14%" } },
        React.createElement(Text, { style: styles.tableCellTextBold }, `Q${q.number}`)
      ),
      React.createElement(
        View,
        { style: { width: "18%" } },
        React.createElement(Text, { style: styles.tableCellText }, q.type)
      ),
      React.createElement(
        View,
        { style: { width: "18%" } },
        React.createElement(Text, { style: styles.tableCellText }, `+${q.marks.toFixed(1)}`)
      ),
      React.createElement(
        View,
        { style: { width: "50%" } },
        React.createElement(
          Text,
          { style: styles.tableCellTextBold },
          formatCorrectAnswerText(q).slice(0, 48)
        )
      )
    );
  });

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.runningHeader, fixed: true },
        React.createElement(
          Text,
          { style: styles.runningHeaderTextLeft },
          `${item.course_code} • ${item.course_name.slice(0, 45)}`
        ),
        React.createElement(
          Text,
          { style: styles.runningHeaderTextRight },
          "OFFICIAL QUESTION PAPER & SOLUTIONS"
        )
      ),
      React.createElement(
        View,
        { style: styles.runningFooter, fixed: true },
        React.createElement(
          Text,
          { style: styles.runningFooterTextLeft },
          "Test Taker Academic Assessment System • All Rights Reserved"
        ),
        React.createElement(Text, { style: styles.runningFooterTextCenter }, "CONFIDENTIAL"),
        React.createElement(Text, {
          style: styles.runningFooterTextRight,
          render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
        })
      ),
      React.createElement(View, { style: styles.coverTopBar }),
      React.createElement(View, { style: styles.coverSubBar }),
      React.createElement(
        Text,
        { style: styles.instBanner },
        "INDIAN INSTITUTE OF TECHNOLOGY MADRAS • BS DEGREE PROGRAM"
      ),
      React.createElement(
        Text,
        { style: styles.mainTitle },
        "EXAMINATION QUESTION PAPER & DETAILED SOLUTIONS"
      ),
      React.createElement(Text, { style: styles.courseTitle }, paper.title),
      React.createElement(
        View,
        { style: styles.metaGrid },
        React.createElement(
          View,
          { style: styles.metaCell },
          React.createElement(Text, { style: styles.metaLabel }, "Course Code"),
          React.createElement(Text, { style: styles.metaValue }, item.course_code)
        ),
        React.createElement(
          View,
          { style: styles.metaCell },
          React.createElement(Text, { style: styles.metaLabel }, "Examination"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            `${item.term} ${item.year} (${item.exam_type})`
          )
        ),
        React.createElement(
          View,
          { style: styles.metaCell },
          React.createElement(Text, { style: styles.metaLabel }, "Total Questions"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            `${paper.total_questions || questions.length} Items`
          )
        ),
        React.createElement(
          View,
          { style: styles.metaCellLast },
          React.createElement(Text, { style: styles.metaLabel }, "Maximum Marks"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            `${paper.total_marks || 100} Marks`
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.instructBox },
        React.createElement(
          Text,
          { style: styles.instructTitle },
          "GENERAL CANDIDATE INSTRUCTIONS & ASSESSMENT GUIDELINES"
        ),
        React.createElement(
          Text,
          { style: styles.instructText },
          "1. All questions are compulsory. Marks allocated to each question are indicated in the header pill."
        ),
        React.createElement(
          Text,
          { style: styles.instructText },
          "2. Carefully inspect all embedded figures, code snippets, and diagrams before answering."
        ),
        React.createElement(
          Text,
          { style: styles.instructText },
          "3. Verified correct answers are indicated with green highlights and summarized in the evaluation matrix at the end of this paper."
        )
      ),
      ...questionElements,
      React.createElement(
        View,
        { wrap: false, style: { marginTop: 14 } },
        React.createElement(
          Text,
          {
            style: {
              fontSize: 11,
              fontFamily: "Times-Bold",
              color: "#1e3a8a",
              marginBottom: 6,
            },
          },
          "MASTER ANSWER KEY & EVALUATION MATRIX"
        ),
        React.createElement(
          View,
          { style: styles.tableContainer },
          React.createElement(
            View,
            { style: styles.tableHeader },
            React.createElement(
              View,
              { style: { width: "14%" } },
              React.createElement(Text, { style: styles.tableHeaderText }, "Q.NO")
            ),
            React.createElement(
              View,
              { style: { width: "18%" } },
              React.createElement(Text, { style: styles.tableHeaderText }, "TYPE")
            ),
            React.createElement(
              View,
              { style: { width: "18%" } },
              React.createElement(Text, { style: styles.tableHeaderText }, "MAX MARKS")
            ),
            React.createElement(
              View,
              { style: { width: "50%" } },
              React.createElement(Text, { style: styles.tableHeaderText }, "OFFICIAL ANSWER KEY")
            )
          ),
          ...matrixRows
        ),
        React.createElement(
          Text,
          { style: styles.endNotice },
          "— END OF EXAMINATION QUESTION PAPER & OFFICIAL SOLUTIONS —"
        )
      )
    )
  );
}

export async function downloadPaperPdf(
  source: CatalogItem | Paper,
  catalogItem?: CatalogItem,
  onProgress?: (msg: string) => void
): Promise<void> {
  let paper: Paper;
  let item: CatalogItem | undefined = catalogItem;

  if ("questions" in source && Array.isArray((source as Paper).questions)) {
    paper = source as Paper;
  } else {
    const cat = source as CatalogItem;
    item = cat;
    if (onProgress) onProgress("Retrieving examination data...");
    paper = await fetchJsonWithFallback<Paper>(cat.json_file);
  }

  if (!item) {
    item = resolveCatalogItem(paper);
  }

  if (onProgress) onProgress("Processing illustrations and diagrams...");
  const imageMap = await preloadAllPaperImages(paper, onProgress);

  if (onProgress) onProgress("Synthesizing vector PDF document...");
  const docElement = buildPaperDocument(paper, item, imageMap) as React.ReactElement<DocumentProps>;

  const blob = await pdf(docElement).toBlob();
  const filename = `${item.course_code}_${item.year}_${item.exam_type}_Solutions.pdf`.replace(
    /\s+/g,
    "_"
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const downloadLatexPdf = downloadPaperPdf;
