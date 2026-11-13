import re
from typing import Any, Dict, List, Optional, Set, Union

try:
    from backend.models import Question, QuestionScore
except ModuleNotFoundError:
    from models import Question, QuestionScore


def normalize_text_val(val: Any) -> str:
    """Normalize string value: lowercase, strip extra whitespace, normalize punctuation."""
    v = str(val).strip().lower()
    # Normalize brackets and common separators
    v = re.sub(r"\s*([,;:|\(\)\[\]])\s*", r"\1", v)
    v = re.sub(r"\s+", " ", v)
    return v


def check_single_candidate(user_val: str, cand: str) -> bool:
    """Check a single target candidate against the user answer."""
    cand = cand.strip()
    if not cand:
        return False

    # 1. Range match: "X to Y" (e.g. "0.264 to 0.272" or "10 to 15")
    range_match = re.match(
        r"^\s*([+-]?\d+(?:\.\d+)?)\s+to\s+([+-]?\d+(?:\.\d+)?)\s*$",
        cand,
        re.IGNORECASE,
    )
    if range_match:
        try:
            u_num = float(user_val.strip())
            low = float(range_match.group(1))
            high = float(range_match.group(2))
            if low > high:
                low, high = high, low
            return (low - 1e-4) <= u_num <= (high + 1e-4)
        except ValueError:
            return False

    # 2. Pure numeric comparison
    try:
        u_num = float(user_val.strip())
        c_num = float(cand)
        # Relative or absolute tolerance
        diff = abs(u_num - c_num)
        return diff < 1e-3 or (diff / max(abs(c_num), 1.0)) < 1e-3
    except ValueError:
        pass

    # 3. Textual / symbolic comparison (e.g. "F,E,A,L", "clear(B),on(B,D)")
    return normalize_text_val(user_val) == normalize_text_val(cand)


def check_numeric_match(user_val: str, target: str) -> bool:
    """Matches user input against numeric/short-answer targets, supporting ranges, multi-candidates, and text answers."""
    user_str = str(user_val).strip()
    target_str = str(target).strip()
    if not user_str or not target_str:
        return False

    # Direct match on the whole target
    if check_single_candidate(user_str, target_str):
        return True

    # Check candidates separated by newlines, semicolons, or " or "
    candidates = re.split(r"[\r\n;]+|\s+or\s+", target_str, flags=re.I)
    for c in candidates:
        if c.strip() and check_single_candidate(user_str, c.strip()):
            return True

    # Check space-separated alternative candidates (e.g. "40,36,40,42 40,36,38,42" or "A,B,C D,E,F")
    if " " in target_str and " to " not in target_str.lower():
        words = target_str.split()
        for w in words:
            if check_single_candidate(user_str, w):
                return True

    return False


def option_to_letter(opt_idx: int) -> str:
    return chr(65 + opt_idx) if 0 <= opt_idx < 26 else str(opt_idx + 1)


def score_question(q: Question, user_ans: Optional[Union[str, List[str], float]]) -> QuestionScore:
    if user_ans is None or user_ans == "" or user_ans == []:
        return QuestionScore(
            question_id=q.id,
            marks_awarded=0.0,
            max_marks=q.marks,
            status="unattempted",
            detail="Unattempted",
            user_answer=None,
            correct_answer=q.correct_answer,
        )

    # -------------------------------------------------------------
    # 1. NUMERIC / SHORT ANSWER
    # -------------------------------------------------------------
    if q.type == "numeric":
        val_str = str(user_ans).strip()
        corr_str = str(q.correct_answer or "").strip()
        is_ok = check_numeric_match(val_str, corr_str)
        if is_ok:
            return QuestionScore(
                question_id=q.id,
                marks_awarded=q.marks,
                max_marks=q.marks,
                status="correct",
                detail=f"Correct numeric value (+{q.marks:.2f} / {q.marks:.2f}). Accepted answer: {corr_str}",
                user_answer=val_str,
                correct_answer=q.correct_answer,
            )
        else:
            deduct = -q.negative_marks if q.negative_marks > 0 else 0.0
            return QuestionScore(
                question_id=q.id,
                marks_awarded=deduct,
                max_marks=q.marks,
                status="incorrect",
                detail=f"Incorrect numeric value ({deduct:.2f} / {q.marks:.2f}). Accepted answer: {corr_str}",
                user_answer=val_str,
                correct_answer=q.correct_answer,
            )

    # Helper: build letter -> option_text map
    opt_letter_map = {}
    if q.options:
        for idx, opt_text in enumerate(q.options):
            let = option_to_letter(idx)
            opt_letter_map[let.lower()] = opt_text
            opt_letter_map[opt_text] = opt_text

    # -------------------------------------------------------------
    # 2. MCQ (Single Choice)
    # -------------------------------------------------------------
    if q.type == "MCQ":
        selected = user_ans[0] if isinstance(user_ans, list) and user_ans else str(user_ans)
        selected_clean = str(selected).strip()

        # Map single letter choice "A" to option text if needed
        if selected_clean.lower() in opt_letter_map:
            selected_mapped = opt_letter_map[selected_clean.lower()]
        else:
            selected_mapped = selected_clean

        corr_targets = q.correct_answer if isinstance(q.correct_answer, list) else [q.correct_answer]
        corr_targets_clean = [str(opt).strip() for opt in corr_targets if opt is not None]

        # Check match by mapped text, raw text, or letter index
        is_ok = False
        for ct in corr_targets_clean:
            if selected_clean == ct or selected_mapped == ct:
                is_ok = True
                break
            if normalize_text_val(selected_clean) == normalize_text_val(ct):
                is_ok = True
                break

        if is_ok:
            return QuestionScore(
                question_id=q.id,
                marks_awarded=q.marks,
                max_marks=q.marks,
                status="correct",
                detail=f"Correct answer (+{q.marks:.2f} / {q.marks:.2f})",
                user_answer=selected,
                correct_answer=q.correct_answer,
            )
        else:
            deduct = -q.negative_marks if q.negative_marks > 0 else 0.0
            return QuestionScore(
                question_id=q.id,
                marks_awarded=deduct,
                max_marks=q.marks,
                status="incorrect",
                detail=f"Incorrect answer ({deduct:.2f} / {q.marks:.2f})",
                user_answer=selected,
                correct_answer=q.correct_answer,
            )

    # -------------------------------------------------------------
    # 3. MSQ / MULTIPLE SELECT
    # -------------------------------------------------------------
    raw_selected_list = [user_ans] if isinstance(user_ans, (str, float)) else list(user_ans)
    selected_set: Set[str] = set()
    for item in raw_selected_list:
        clean_item = str(item).strip()
        if not clean_item:
            continue
        # Map letter "A" to option text if applicable
        if clean_item.lower() in opt_letter_map:
            selected_set.add(normalize_text_val(opt_letter_map[clean_item.lower()]))
        else:
            selected_set.add(normalize_text_val(clean_item))

    raw_corr_list = [q.correct_answer] if isinstance(q.correct_answer, (str, float)) else list(q.correct_answer or [])
    corr_set: Set[str] = set()
    for item in raw_corr_list:
        clean_item = str(item).strip()
        if not clean_item:
            continue
        if clean_item.lower() in opt_letter_map:
            corr_set.add(normalize_text_val(opt_letter_map[clean_item.lower()]))
        else:
            corr_set.add(normalize_text_val(clean_item))

    if not selected_set:
        return QuestionScore(
            question_id=q.id,
            marks_awarded=0.0,
            max_marks=q.marks,
            status="unattempted",
            detail="Unattempted",
            user_answer=None,
            correct_answer=q.correct_answer,
        )

    wrong_selected = selected_set - corr_set
    correct_selected = selected_set & corr_set
    total_corr = len(corr_set)

    # Any wrong option selected incurs penalty / incorrect
    if len(wrong_selected) > 0:
        deduct = -q.negative_marks if q.negative_marks > 0 else 0.0
        return QuestionScore(
            question_id=q.id,
            marks_awarded=deduct,
            max_marks=q.marks,
            status="incorrect",
            detail=f"Incorrect option selected ({deduct:.2f} / {q.marks:.2f})",
            user_answer=raw_selected_list,
            correct_answer=list(q.correct_answer or []),
        )

    # All correct options selected
    if len(correct_selected) == total_corr:
        return QuestionScore(
            question_id=q.id,
            marks_awarded=q.marks,
            max_marks=q.marks,
            status="correct",
            detail=f"All {total_corr} correct options selected (+{q.marks:.2f} / {q.marks:.2f})",
            user_answer=raw_selected_list,
            correct_answer=list(q.correct_answer or []),
        )

    # Partial credit for subset of correct options
    ratio = len(correct_selected) / total_corr if total_corr > 0 else 0.0
    awarded = round(ratio * q.marks, 2)
    return QuestionScore(
        question_id=q.id,
        marks_awarded=awarded,
        max_marks=q.marks,
        status="partial",
        detail=f"Partial credit: {len(correct_selected)} of {total_corr} correct options selected (+{awarded:.2f} / {q.marks:.2f})",
        user_answer=raw_selected_list,
        correct_answer=list(q.correct_answer or []),
    )
