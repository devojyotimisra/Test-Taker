import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pdfplumber
from pypdf import PdfReader
try:
    from backend.models import Paper, Question
except ModuleNotFoundError:
    from models import Paper, Question

def is_green_color(color: Any) -> bool:
    if not isinstance(color, (tuple, list)) or len(color) != 3:
        return False
    r, g, b = color
    return g > 0.35 and r < 0.2 and b < 0.2

def classify_icon(pil_img) -> Optional[str]:
    if pil_img.size != (16, 16):
        return None
    arr = np.array(pil_img.convert("RGBA"))
    mask = (arr[:, :, 3] > 50) & ((arr[:, :, 0] < 240) | (arr[:, :, 1] < 240) | (arr[:, :, 2] < 240))
    if not mask.any():
        return None
    mean_rgb = arr[mask][:, :3].mean(axis=0)
    return "tick" if mean_rgb[1] > mean_rgb[0] else "cross"

def extract_layout(pdf_path: str) -> Tuple[List[Dict[str, Any]], Dict[Tuple[int, str], Any]]:
    reader = PdfReader(pdf_path)
    pypdf_images: Dict[Tuple[int, str], Any] = {}
    icon_types: Dict[Tuple[int, str], str] = {}

    for p_idx, page in enumerate(reader.pages):
        for img in page.images:
            base_name = img.name.split(".")[0]
            if img.image.size == (16, 16):
                icon_cls = classify_icon(img.image)
                if icon_cls:
                    icon_types[(p_idx, base_name)] = icon_cls
            else:
                pypdf_images[(p_idx, base_name)] = img

    all_lines: List[Dict[str, Any]] = []

    with pdfplumber.open(pdf_path) as pdf:
        for p_idx, page in enumerate(pdf.pages):
            words = page.extract_words(extra_attrs=["non_stroking_color", "fontname", "size"])
            text_lines: List[Dict[str, Any]] = []
            for w in words:
                if not text_lines or abs(w["top"] - text_lines[-1]["top"]) > 4.5:
                    text_lines.append(
                        {
                            "type": "text_line",
                            "page": p_idx,
                            "top": w["top"],
                            "bottom": w["bottom"],
                            "tokens": [
                                {
                                    "kind": "word",
                                    "x0": w["x0"],
                                    "x1": w["x1"],
                                    "top": w["top"],
                                    "bottom": w["bottom"],
                                    "text": w["text"],
                                    "color": w.get("non_stroking_color"),
                                }
                            ],
                            "icon": None,
                        }
                    )
                else:
                    text_lines[-1]["tokens"].append(
                        {
                            "kind": "word",
                            "x0": w["x0"],
                            "x1": w["x1"],
                            "top": w["top"],
                            "bottom": w["bottom"],
                            "text": w["text"],
                            "color": w.get("non_stroking_color"),
                        }
                    )
                    text_lines[-1]["bottom"] = max(text_lines[-1]["bottom"], w["bottom"])

            standalone_img_lines: List[Dict[str, Any]] = []

            for img_meta in page.images:
                img_name = img_meta.get("name", "")
                srcsize = img_meta.get("srcsize")
                if srcsize == (16, 16) or (abs(img_meta["width"] - 12.0) < 1.0 and abs(img_meta["height"] - 12.0) < 1.0):
                    icon_cls = icon_types.get((p_idx, img_name))
                    if icon_cls:
                        for tl in text_lines:
                            if abs(tl["top"] - img_meta["top"]) < 8.0:
                                tl["icon"] = icon_cls
                                break
                    continue

                is_inline = img_meta["height"] < 40.0
                attached = False
                if is_inline:
                    best_tl = None
                    best_diff = 999.0
                    for tl in text_lines:
                        diff = abs(img_meta["bottom"] - tl["bottom"])
                        if diff <= 8.0 and diff < best_diff:
                            best_diff = diff
                            best_tl = tl
                    if best_tl is not None:
                        best_tl["tokens"].append(
                            {
                                "kind": "inline_image",
                                "x0": img_meta["x0"],
                                "x1": img_meta["x1"],
                                "top": img_meta["top"],
                                "bottom": img_meta["bottom"],
                                "page": p_idx,
                                "name": img_name,
                                "width": img_meta["width"],
                                "height": img_meta["height"],
                            }
                        )
                        attached = True

                if not attached:
                    standalone_img_lines.append(
                        {
                            "type": "image_block",
                            "page": p_idx,
                            "top": img_meta["top"],
                            "bottom": img_meta["bottom"],
                            "x0": img_meta["x0"],
                            "x1": img_meta["x1"],
                            "name": img_name,
                            "width": img_meta["width"],
                            "height": img_meta["height"],
                        }
                    )

            for tl in text_lines:
                tl["tokens"].sort(key=lambda tok: tok["x0"])

            page_items = text_lines + standalone_img_lines
            page_items.sort(key=lambda item: item["top"])
            all_lines.extend(page_items)

    return all_lines, pypdf_images

def line_raw_text(line: Dict[str, Any]) -> str:
    if line["type"] != "text_line":
        return ""
    return " ".join(tok["text"] for tok in line["tokens"] if tok["kind"] == "word").strip()

def render_line(
    line: Dict[str, Any],
    q_num: int,
    section_stage: int,
    pypdf_images: Dict[Tuple[int, str], Any],
    image_dir: Path,
    image_prefix: str,
    saved_images: List[Dict[str, Any]],
) -> str:
    if line["type"] == "image_block":
        key = (line["page"], line["name"])
        img_obj = pypdf_images.get(key)
        ext = Path(img_obj.name).suffix if img_obj else ".png"
        idx = len(saved_images) + 1
        filename = f"q{q_num}_img{idx}{ext}"
        out_path = image_dir / filename
        if img_obj is not None:
            img_obj.image.save(out_path)
        rel_path = f"{image_prefix}/{filename}" if image_prefix else filename
        saved_images.append({"path": rel_path, "location": section_stage, "is_block": True})
        return f"[IMAGE: {rel_path}]"

    parts: List[str] = []
    for tok in line["tokens"]:
        if tok["kind"] == "word":
            parts.append(tok["text"])
        elif tok["kind"] == "inline_image":
            key = (tok["page"], tok["name"])
            img_obj = pypdf_images.get(key)
            ext = Path(img_obj.name).suffix if img_obj else ".png"
            idx = len(saved_images) + 1
            filename = f"q{q_num}_img{idx}{ext}"
            out_path = image_dir / filename
            if img_obj is not None:
                img_obj.image.save(out_path)
            rel_path = f"{image_prefix}/{filename}" if image_prefix else filename
            saved_images.append({"path": rel_path, "location": section_stage, "is_block": False})
            parts.append(f"[IMAGE: {rel_path}]")
    return " ".join(parts).strip()

def parse_question_block(
    q_num: int,
    q_id: str,
    block_lines: List[Dict[str, Any]],
    pypdf_images: Dict[Tuple[int, str], Any],
    image_dir: Path,
    image_prefix: str,
) -> Dict[str, Any]:
    question_label = ""
    response_type = ""
    marks = 2.0
    negative_marks = 0.0
    state = "HEADER"
    question_parts: List[str] = []
    has_text_before_img = False
    saved_images: List[Dict[str, Any]] = []
    options: List[Dict[str, Any]] = []
    numeric_answer_lines: List[str] = []
    option_pattern = re.compile(r"^(\d{8,15})\.\s*(.*)$")

    for line in block_lines:
        raw_text = line_raw_text(line)

        if any(
            raw_text.startswith(p)
            for p in (
                "Sub-Section Number :",
                "Sub-Section Id :",
                "Question Shuffling Allowed :",
                "Section Id :",
                "Section Number :",
                "Enable Mark as Answered",
                "Clear Response :",
            )
        ):
            continue

        if raw_text.startswith("Correct Marks :"):
            m_corr = re.search(r"Correct Marks\s*:\s*([0-9]+(?:\.[0-9]+)?)", raw_text)
            if m_corr:
                marks = float(m_corr.group(1))
            m_wrong = re.search(r"Wrong Marks\s*:\s*([0-9]+(?:\.[0-9]+)?)", raw_text)
            if m_wrong:
                negative_marks = float(m_wrong.group(1))
            continue

        if raw_text.startswith("Question Label :"):
            question_label = raw_text.split("Question Label :", 1)[1].strip()
            state = "QUESTION"
            continue

        if raw_text == "Options :":
            state = "OPTIONS"
            continue

        if raw_text.startswith("Response Type :"):
            response_type = raw_text.split("Response Type :", 1)[1].strip()
            state = "NUMERIC_META"
            continue

        if raw_text == "Possible Answers :":
            state = "POSSIBLE_ANSWERS"
            continue

        if state == "NUMERIC_META":
            continue

        if state == "QUESTION":
            if line["type"] == "image_block":
                loc = 1 if has_text_before_img else 0
                rendered = render_line(line, q_num, loc, pypdf_images, image_dir, image_prefix, saved_images)
                question_parts.append(rendered)
            elif line["type"] == "text_line":
                if raw_text:
                    has_text_before_img = True
                rendered = render_line(line, q_num, 1, pypdf_images, image_dir, image_prefix, saved_images)
                if rendered:
                    question_parts.append(rendered)

        elif state == "OPTIONS":
            if line["type"] == "text_line":
                m = option_pattern.match(raw_text)
                if m:
                    opt_id = m.group(1)
                    first_word_color = line["tokens"][0].get("color")
                    is_correct = is_green_color(first_word_color) or line.get("icon") == "tick"
                    rendered_full = render_line(line, q_num, 2, pypdf_images, image_dir, image_prefix, saved_images)
                    opt_text = re.sub(r"^\d{8,15}\.\s*", "", rendered_full).strip()
                    options.append({"option_id": opt_id, "text": opt_text, "is_correct": is_correct})
                else:
                    if options:
                        rendered_cont = render_line(line, q_num, 2, pypdf_images, image_dir, image_prefix, saved_images)
                        if rendered_cont:
                            options[-1]["text"] = f"{options[-1]['text']} {rendered_cont}".strip()
            elif line["type"] == "image_block":
                rendered_img = render_line(line, q_num, 2, pypdf_images, image_dir, image_prefix, saved_images)
                if options:
                    options[-1]["text"] = f"{options[-1]['text']} {rendered_img}".strip()

        elif state == "POSSIBLE_ANSWERS":
            if line["type"] == "text_line" and raw_text:
                numeric_answer_lines.append(raw_text)

    label_lower = question_label.lower()
    if "multiple choice" in label_lower:
        answer_type = "MCQ"
    elif "multiple select" in label_lower:
        answer_type = "multichoice"
    elif "short answer" in label_lower or response_type.lower() == "numeric":
        answer_type = "numeric"
    else:
        answer_type = "MCQ"

    question_text = " ".join(question_parts).strip()

    if answer_type == "numeric":
        all_answers = None
        correct_answer = " ".join(numeric_answer_lines).strip()
    elif answer_type == "MCQ":
        all_answers = [opt["text"] for opt in options]
        correct_opts = [opt["text"] for opt in options if opt["is_correct"]]
        correct_answer = correct_opts[0] if len(correct_opts) == 1 else correct_opts
    else:
        all_answers = [opt["text"] for opt in options]
        correct_answer = [opt["text"] for opt in options if opt["is_correct"]]

    img_paths = [img["path"] for img in saved_images]
    img_locs = [img["location"] for img in saved_images]

    return {
        "id": q_num,
        "number": q_num,
        "text": question_text,
        "type": answer_type,
        "options": all_answers,
        "correct_answer": correct_answer,
        "marks": marks,
        "negative_marks": negative_marks,
        "images": img_paths,
        "image_locations": img_locs,
    }

def parse_pdf_to_paper(
    pdf_path: str,
    image_dir: str = "temp/image",
    skip_confirmation: bool = True,
) -> Paper:
    img_path = Path(image_dir)
    img_path.mkdir(parents=True, exist_ok=True)

    all_lines, pypdf_images = extract_layout(pdf_path)

    q_header_re = re.compile(r"^Question\s+Number\s*:\s*(\d+)\s+Question\s+Id\s*:\s*(\d+)")
    question_blocks: List[Tuple[int, str, List[Dict[str, Any]]]] = []
    current_q: Optional[Tuple[int, str, List[Dict[str, Any]]]] = None

    for line in all_lines:
        raw = line_raw_text(line)
        m = q_header_re.match(raw)
        if m:
            if current_q is not None:
                question_blocks.append(current_q)
            current_q = (int(m.group(1)), m.group(2), [])
        else:
            if current_q is not None:
                current_q[2].append(line)

    if current_q is not None:
        question_blocks.append(current_q)

    parsed_list: List[Dict[str, Any]] = []
    for q_num, q_id, b_lines in question_blocks:
        q_dict = parse_question_block(
            q_num=q_num,
            q_id=q_id,
            block_lines=b_lines,
            pypdf_images=pypdf_images,
            image_dir=img_path,
            image_prefix="temp/image",
        )
        if skip_confirmation and q_dict["marks"] == 0 and "ARE YOU SURE" in q_dict["text"].upper():
            continue
        parsed_list.append(q_dict)

    reindexed_questions: List[Question] = []
    for i, q in enumerate(parsed_list):
        q["number"] = i + 1
        q["id"] = i + 1
        reindexed_questions.append(Question(**q))

    paper_name = Path(pdf_path).stem.replace("_", " ").title()
    total_marks = sum(q.marks for q in reindexed_questions)

    return Paper(
        title=paper_name,
        filename=Path(pdf_path).name,
        total_questions=len(reindexed_questions),
        total_marks=round(total_marks, 2),
        questions=reindexed_questions,
    )

