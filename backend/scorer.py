import re
from typing import List, Optional, Set, Union
try:
    from backend.models import Question, QuestionScore
except ModuleNotFoundError:
    from models import Question, QuestionScore


def check_numeric_match(user_val: str, target: str) -> bool:
    try:
        user_num = float(str(user_val).strip())
    except ValueError:
        return False

    range_match = re.match(
        r"^\s*([+-]?\d+(?:\.\d+)?)\s*to\s*([+-]?\d+(?:\.\d+)?)\s*$",
        str(target).strip(),
        re.IGNORECASE,
    )
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        return low <= user_num <= high

    try:
        corr_num = float(str(target).strip())
        return abs(user_num - corr_num) < 1e-4
    except ValueError:
        return str(user_val).strip().lower() == str(target).strip().lower()


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

    if q.type == "MCQ":
        selected = user_ans[0] if isinstance(user_ans, list) and user_ans else str(user_ans)
        selected_clean = str(selected).strip()
        if isinstance(q.correct_answer, list):
            is_ok = any(selected_clean == str(opt).strip() for opt in q.correct_answer)
        else:
            is_ok = selected_clean == str(q.correct_answer or "").strip()

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

    selected_list = [user_ans] if isinstance(user_ans, (str, float)) else list(user_ans)
    selected_set: Set[str] = {str(item).strip() for item in selected_list if str(item).strip()}

    corr_list = [q.correct_answer] if isinstance(q.correct_answer, (str, float)) else list(q.correct_answer or [])
    corr_set: Set[str] = {str(item).strip() for item in corr_list if str(item).strip()}

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

    if len(wrong_selected) > 0:
        deduct = -q.negative_marks if q.negative_marks > 0 else 0.0
        return QuestionScore(
            question_id=q.id,
            marks_awarded=deduct,
            max_marks=q.marks,
            status="incorrect",
            detail=f"Incorrect option selected ({deduct:.2f} / {q.marks:.2f})",
            user_answer=list(selected_set),
            correct_answer=list(corr_set),
        )

    if len(correct_selected) == total_corr:
        return QuestionScore(
            question_id=q.id,
            marks_awarded=q.marks,
            max_marks=q.marks,
            status="correct",
            detail=f"All {total_corr} correct options selected (+{q.marks:.2f} / {q.marks:.2f})",
            user_answer=list(selected_set),
            correct_answer=list(corr_set),
        )

    ratio = len(correct_selected) / total_corr if total_corr > 0 else 0.0
    awarded = round(ratio * q.marks, 2)
    return QuestionScore(
        question_id=q.id,
        marks_awarded=awarded,
        max_marks=q.marks,
        status="partial",
        detail=f"Partial credit: {len(correct_selected)} of {total_corr} correct options selected (+{awarded:.2f} / {q.marks:.2f})",
        user_answer=list(selected_set),
        correct_answer=list(corr_set),
    )
