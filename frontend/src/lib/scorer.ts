import { Question, QuestionScore } from "../types";

function normalizeTextVal(val: unknown): string {
  let v = String(val ?? "").trim().toLowerCase();
  v = v.replace(/\s*([,;:|()[\]])\s*/g, "$1");
  v = v.replace(/\s+/g, " ");
  return v;
}

function checkSingleCandidate(userVal: string, cand: string): boolean {
  const c = cand.trim();
  if (!c) return false;

  const rangeMatch = c.match(/^\s*([+-]?\d+(?:\.\d+)?)\s+to\s+([+-]?\d+(?:\.\d+)?)\s*$/i);
  if (rangeMatch) {
    const uNum = parseFloat(userVal.trim());
    if (isNaN(uNum)) return false;
    let low = parseFloat(rangeMatch[1]);
    let high = parseFloat(rangeMatch[2]);
    if (low > high) {
      const temp = low;
      low = high;
      high = temp;
    }
    return (low - 1e-4) <= uNum && uNum <= (high + 1e-4);
  }

  const uNum = parseFloat(userVal.trim());
  const cNum = parseFloat(c);
  if (!isNaN(uNum) && !isNaN(cNum)) {
    const diff = Math.abs(uNum - cNum);
    if (diff < 1e-3 || (diff / Math.max(Math.abs(cNum), 1.0)) < 1e-3) {
      return true;
    }
  }

  return normalizeTextVal(userVal) === normalizeTextVal(c);
}

function checkNumericMatch(userVal: string, target: string): boolean {
  const uStr = String(userVal ?? "").trim();
  const tStr = String(target ?? "").trim();
  if (!uStr || !tStr) return false;

  if (checkSingleCandidate(uStr, tStr)) return true;

  const candidates = tStr.split(/[\r\n;]+|\s+or\s+/i);
  for (const c of candidates) {
    if (c.trim() && checkSingleCandidate(uStr, c.trim())) {
      return true;
    }
  }

  if (tStr.includes(" ") && !tStr.toLowerCase().includes(" to ")) {
    const words = tStr.split(/\s+/);
    for (const w of words) {
      if (checkSingleCandidate(uStr, w)) {
        return true;
      }
    }
  }

  return false;
}

function optionToLetter(optIdx: number): string {
  return optIdx >= 0 && optIdx < 26 ? String.fromCharCode(65 + optIdx) : String(optIdx + 1);
}

export function scoreQuestion(
  q: Question,
  userAns: string | string[] | number | null | undefined
): QuestionScore {
  if (userAns === null || userAns === undefined || userAns === "" || (Array.isArray(userAns) && userAns.length === 0)) {
    return {
      question_id: q.id,
      marks_awarded: 0.0,
      max_marks: q.marks,
      status: "unattempted",
      detail: "Unattempted",
      user_answer: null,
      correct_answer: q.correct_answer,
    };
  }

  if (q.type === "numeric") {
    const valStr = String(userAns).trim();
    const corrStr = String(q.correct_answer ?? "").trim();
    const isOk = checkNumericMatch(valStr, corrStr);
    if (isOk) {
      return {
        question_id: q.id,
        marks_awarded: q.marks,
        max_marks: q.marks,
        status: "correct",
        detail: `Correct numeric value (+${q.marks.toFixed(2)} / ${q.marks.toFixed(2)}). Accepted answer: ${corrStr}`,
        user_answer: valStr,
        correct_answer: q.correct_answer,
      };
    }
    const deduct = q.negative_marks > 0 ? -q.negative_marks : 0.0;
    return {
      question_id: q.id,
      marks_awarded: deduct,
      max_marks: q.marks,
      status: "incorrect",
      detail: `Incorrect numeric value (${deduct.toFixed(2)} / ${q.marks.toFixed(2)}). Accepted answer: ${corrStr}`,
      user_answer: valStr,
      correct_answer: q.correct_answer,
    };
  }

  const optLetterMap: Record<string, string> = {};
  if (q.options) {
    q.options.forEach((optText, idx) => {
      const letKey = optionToLetter(idx);
      optLetterMap[letKey.toLowerCase()] = optText;
      optLetterMap[optText] = optText;
    });
  }

  if (q.type === "MCQ") {
    const selected = Array.isArray(userAns) ? userAns[0] : String(userAns);
    const selectedClean = String(selected ?? "").trim();
    const selectedMapped = optLetterMap[selectedClean.toLowerCase()] ?? selectedClean;

    const corrTargets = Array.isArray(q.correct_answer)
      ? q.correct_answer
      : [q.correct_answer];
    const corrTargetsClean = corrTargets
      .filter((opt) => opt !== null && opt !== undefined)
      .map((opt) => String(opt).trim());

    let isOk = false;
    for (const ct of corrTargetsClean) {
      if (selectedClean === ct || selectedMapped === ct) {
        isOk = true;
        break;
      }
      if (normalizeTextVal(selectedClean) === normalizeTextVal(ct)) {
        isOk = true;
        break;
      }
    }

    if (isOk) {
      return {
        question_id: q.id,
        marks_awarded: q.marks,
        max_marks: q.marks,
        status: "correct",
        detail: `Correct answer (+${q.marks.toFixed(2)} / ${q.marks.toFixed(2)})`,
        user_answer: selected,
        correct_answer: q.correct_answer,
      };
    }

    const deduct = q.negative_marks > 0 ? -q.negative_marks : 0.0;
    return {
      question_id: q.id,
      marks_awarded: deduct,
      max_marks: q.marks,
      status: "incorrect",
      detail: `Incorrect answer (${deduct.toFixed(2)} / ${q.marks.toFixed(2)})`,
      user_answer: selected,
      correct_answer: q.correct_answer,
    };
  }

  const rawSelectedList: string[] = (Array.isArray(userAns) ? userAns : [userAns]).map(String);
  const selectedSet = new Set<string>();
  for (const item of rawSelectedList) {
    const cleanItem = String(item ?? "").trim();
    if (!cleanItem) continue;
    if (optLetterMap[cleanItem.toLowerCase()]) {
      selectedSet.add(normalizeTextVal(optLetterMap[cleanItem.toLowerCase()]));
    } else {
      selectedSet.add(normalizeTextVal(cleanItem));
    }
  }

  const rawCorrList = Array.isArray(q.correct_answer)
    ? q.correct_answer
    : q.correct_answer !== null && q.correct_answer !== undefined
    ? [q.correct_answer]
    : [];
  const corrSet = new Set<string>();
  for (const item of rawCorrList) {
    const cleanItem = String(item ?? "").trim();
    if (!cleanItem) continue;
    if (optLetterMap[cleanItem.toLowerCase()]) {
      corrSet.add(normalizeTextVal(optLetterMap[cleanItem.toLowerCase()]));
    } else {
      corrSet.add(normalizeTextVal(cleanItem));
    }
  }

  if (selectedSet.size === 0) {
    return {
      question_id: q.id,
      marks_awarded: 0.0,
      max_marks: q.marks,
      status: "unattempted",
      detail: "Unattempted",
      user_answer: null,
      correct_answer: q.correct_answer,
    };
  }

  let wrongCount = 0;
  let correctCount = 0;
  for (const sel of selectedSet) {
    if (corrSet.has(sel)) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const totalCorr = corrSet.size;

  if (wrongCount > 0) {
    const deduct = q.negative_marks > 0 ? -q.negative_marks : 0.0;
    return {
      question_id: q.id,
      marks_awarded: deduct,
      max_marks: q.marks,
      status: "incorrect",
      detail: `Incorrect option selected (${deduct.toFixed(2)} / ${q.marks.toFixed(2)})`,
      user_answer: rawSelectedList,
      correct_answer: q.correct_answer,
    };
  }

  if (correctCount === totalCorr) {
    return {
      question_id: q.id,
      marks_awarded: q.marks,
      max_marks: q.marks,
      status: "correct",
      detail: `All ${totalCorr} correct options selected (+${q.marks.toFixed(2)} / ${q.marks.toFixed(2)})`,
      user_answer: rawSelectedList,
      correct_answer: q.correct_answer,
    };
  }

  const ratio = totalCorr > 0 ? correctCount / totalCorr : 0.0;
  const awarded = parseFloat((ratio * q.marks).toFixed(2));
  return {
    question_id: q.id,
    marks_awarded: awarded,
    max_marks: q.marks,
    status: "partial",
    detail: `Partial credit: ${correctCount} of ${totalCorr} correct options selected (+${awarded.toFixed(2)} / ${q.marks.toFixed(2)})`,
    user_answer: rawSelectedList,
    correct_answer: q.correct_answer,
  };
}

