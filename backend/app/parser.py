import base64
import io
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from PIL import Image
import pdfplumber
from pypdf import PdfReader
from pydantic import BaseModel


class Question(BaseModel):
    id: int
    number: int
    original_number: Optional[int] = None
    text: str
    type: str
    options: Optional[List[str]] = None
    correct_answer: Optional[Union[str, List[str], float]] = None
    marks: float = 1.0
    negative_marks: float = 0.0
    images: List[str] = []
    image_locations: List[int] = []
    comprehension_passage: Optional[str] = None
    group_id: Optional[str] = None
    section_name: Optional[str] = None


class Paper(BaseModel):
    title: str
    filename: str
    total_questions: int
    total_marks: float
    questions: List[Question]

META_KEYS = [
    "Sub-Section Number", "Sub-Section Id", "Question Shuffling Allowed",
    "Sub Question Shuffling Allowed", "Response Type", "Evaluation Required For SA",
    "Show Word Count", "Answers Type", "Text Areas", "Section Id", "Section Number",
    "Section type", "Mandatory or Optional", "Number of Questions",
    "Number of Questions to be attempted", "Section Marks", "Display Number Panel",
    "Section Negative Marks", "Group All Questions", "Enable Mark as Answered",
    "Clear Response", "Section Maximum Duration", "Section Minimum Duration",
    "Section Time In", "Maximum Instruction Time", "Minimum Instruction Time",
    "Group Number", "Group Id", "Group Maximum Duration", "Group Minimum Duration",
    "Show Attended Group", "Edit Attended Group", "Break time", "Group Marks",
    "Is this Group for Examiner", "Examiner permission", "Show Progress Bar",
    "Revisit allowed for group Instructions", "Group Time In", "Revisit Section",
    "Action on Revisit Section", "Navigate To Group Summary From Last Question",
    "Disable Submit Button During Assessment", "Section Selection Time",
    "No of Optional sections to be attempted", "Question Paper Name", "Subject Name",
    "Creation Date", "Duration", "Total Marks", "Display Marks",
    "Share Answer Key With Delivery Engine", "Actual Answer Key", "Calculator",
    "Magnifying Glass Required", "Ruler Required", "Eraser Required",
    "Scratch Pad Required", "Rough Sketch/Notepad Required", "Protractor Required",
    "Show Watermark on Console", "Highlighter", "Auto Save on Console",
    "Change Font Color", "Change Background Color", "Change Theme", "Help Button",
    "Show Reports", "Group Comprehension Questions", "Question Pattern Type",
    "Correct Marks", "Question Label", "Question Numbers", "Is Section Default",
    "Section Duration", "Question Type",
]
META_RE = re.compile(
    r"^\s*(?:" + "|".join(re.escape(k) for k in sorted(META_KEYS, key=len, reverse=True))
    + r")\b[^:]{0,40}:", re.I
)
NOISE_RE = re.compile(
    r"^\s*(Notations\s*:|\d\.\s*Options shown in|Indian Institute of Technology|"
    r"Allowed\s*:|Questions\s*:\s*(Yes|No)|Group\s+[IVXLC\d]+\s*$)", re.I
)
QNUM_RE = re.compile(
    r"Question\s+Number\s*:\s*(\d+)\s*Question\s+Id\s*:\s*(\d+)"
    r"(?:\s*Question\s+Type\s*:\s*([A-Za-z_]+))?", re.I
)
QGROUP_RE = re.compile(r"^\s*Question\s+Id\s*:\s*(\d+)", re.I)
QNUMS_RE = re.compile(r"Question\s+Numbers\s*:\s*\(\s*(\d+)\s*to\s*(\d+)\s*\)", re.I)
MARKS_RE = re.compile(r"Correct\s+Marks\s*:\s*([\d.]+)", re.I)
NEG_RE = re.compile(r"(?:Wrong|Negative)\s+Marks\s*:\s*([\d.]+)", re.I)
LABEL_RE = re.compile(r"^\s*Question\s+Label\s*:\s*(.+)$", re.I)
OPTID_RE = re.compile(r"^\s*(\d{8,})\s*\.\s*")
SUBJECT_CHECK_RE = re.compile(r"THIS IS QUESTION PAPER FOR THE SUBJECT\s*\"?(.+?)\"", re.I | re.S)

def is_green_color(color: Any) -> bool:
    if not isinstance(color, (tuple, list)) or len(color) != 3:
        return False
    r, g, b = color
    if isinstance(r, float) and r <= 1.0 and g <= 1.0 and b <= 1.0:
        return g > 0.35 and r < 0.2 and b < 0.2
    return g > 90 and g > r + 35 and g > b + 35

def classify_icon_pil(pil_img: Image.Image) -> Optional[str]:
    try:
        if pil_img.size != (16, 16):
            return None
        rgba = pil_img.convert("RGBA")
        green_count = 0
        red_count = 0
        for pixel in rgba.getdata():
            r, g, b, a = pixel[:4]
            if a > 50 and (r < 240 or g < 240 or b < 240):
                if g > r:
                    green_count += 1
                else:
                    red_count += 1
        if green_count == 0 and red_count == 0:
            return None
        return "tick" if green_count > red_count else "cross"
    except Exception:
        return None

def parse_with_pdfplumber(
    pdf_path: str,
    image_dir: str = "temp/image",
    image_prefix: Optional[str] = "temp/image",
    skip_confirmation: bool = False,
    embed_base64: bool = True,
) -> Paper:
    reader = PdfReader(pdf_path)
    pypdf_images: Dict[Tuple[int, str], Any] = {}
    pypdf_b64: Dict[Tuple[int, str], str] = {}
    icon_types: Dict[Tuple[int, str], str] = {}

    out_path = Path(image_dir) if image_dir else None
    if out_path:
        try:
            out_path.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    for p_idx, page in enumerate(reader.pages):
        try:
            page_imgs = list(page.images)
        except Exception:
            page_imgs = []
        for img in page_imgs:
            base_name = img.name.split(".")[0]
            if img.image.size == (16, 16):
                icon_cls = classify_icon_pil(img.image)
                if icon_cls:
                    icon_types[(p_idx, base_name)] = icon_cls
            else:
                pypdf_images[(p_idx, base_name)] = img
                if embed_base64:
                    try:
                        buf = io.BytesIO()
                        img.image.save(buf, format="PNG")
                        b64_str = base64.b64encode(buf.getvalue()).decode("ascii")
                        pypdf_b64[(p_idx, base_name)] = f"data:image/png;base64,{b64_str}"
                    except Exception:
                        pass

    def line_text(line: Dict[str, Any]) -> str:
        if line["type"] != "text_line":
            return ""
        return " ".join(tok["text"] for tok in line["tokens"] if tok["kind"] == "word").strip()

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
                                    "size": w.get("size"),
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
                            "size": w.get("size"),
                        }
                    )
                    text_lines[-1]["bottom"] = max(text_lines[-1]["bottom"], w["bottom"])

            standalone_img_lines: List[Dict[str, Any]] = []

            for img_meta in page.images:
                img_name = img_meta.get("name", "")
                srcsize = img_meta.get("srcsize")
                if (srcsize == (16, 16) and img_meta.get("x0", 0) < 130) or (abs(img_meta["width"] - 12.0) < 1.5 and abs(img_meta["height"] - 12.0) < 1.5 and img_meta.get("x0", 0) < 130):
                    icon_cls = icon_types.get((p_idx, img_name))
                    if icon_cls:
                        for tl in text_lines:
                            if abs(tl["top"] - img_meta["top"]) < 8.0:
                                tl["icon"] = icon_cls
                                break
                    continue

                attached = False
                if img_meta["x0"] > 100:
                    best_opt_tl = None
                    best_opt_diff = 999.0
                    for tl in text_lines:
                        first_tok = tl["tokens"][0] if tl["tokens"] else {}
                        is_opt_line = bool(OPTID_RE.match(line_text(tl))) and first_tok.get("x0", 0) < 120
                        if is_opt_line:
                            diff_bot = abs(img_meta["bottom"] - tl["bottom"])
                            if diff_bot <= 8.0 and diff_bot < best_opt_diff:
                                best_opt_diff = diff_bot
                                best_opt_tl = tl
                            elif tl["bottom"] >= img_meta["top"] and tl["top"] <= img_meta["bottom"] + 5.0 and diff_bot <= 15.0 and diff_bot < best_opt_diff:
                                best_opt_diff = diff_bot
                                best_opt_tl = tl
                    if best_opt_tl is not None:
                        best_opt_tl["tokens"].append(
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

                if not attached and img_meta["height"] < 35.0:
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

    stem = Path(pdf_path).stem

    def render_token_line(line: Dict[str, Any]) -> str:
        if line["type"] == "image_block":
            key = (line["page"], line["name"])
            b64 = pypdf_b64.get(key)
            if embed_base64 and b64:
                return f"[IMAGE: {b64}|block]"
            img_obj = pypdf_images.get(key)
            filename = f"{stem}_p{line['page']}_{line['name']}.webp"
            if out_path and img_obj:
                try:
                    pil_img = img_obj.image
                    if pil_img.mode not in ("RGB", "RGBA"):
                        pil_img = pil_img.convert("RGB")
                    target_file = out_path / filename
                    if not target_file.exists():
                        pil_img.save(target_file, format="WEBP", quality=80)
                except Exception:
                    pass
            rel = f"{image_prefix}/{filename}" if image_prefix else filename
            return f"[IMAGE: {rel}|block]"

        parts = []
        for tok in line["tokens"]:
            if tok["kind"] == "word":
                parts.append(tok["text"])
            elif tok["kind"] == "inline_image":
                mode = "block" if tok.get("height", 0) >= 35.0 else "inline"
                key = (tok["page"], tok["name"])
                b64 = pypdf_b64.get(key)
                if embed_base64 and b64:
                    parts.append(f"[IMAGE: {b64}|{mode}]")
                else:
                    img_obj = pypdf_images.get(key)
                    filename = f"{stem}_p{tok['page']}_{tok['name']}.webp"
                    if out_path and img_obj:
                        try:
                            pil_img = img_obj.image
                            if pil_img.mode not in ("RGB", "RGBA"):
                                pil_img = pil_img.convert("RGB")
                            target_file = out_path / filename
                            if not target_file.exists():
                                pil_img.save(target_file, format="WEBP", quality=80)
                        except Exception:
                            pass
                    rel = f"{image_prefix}/{filename}" if image_prefix else filename
                    parts.append(f"[IMAGE: {rel}|{mode}]")
        return " ".join(parts).strip()

    questions: List[Dict[str, Any]] = []
    groups: Dict[str, Dict[str, Any]] = {}
    current_q: Optional[Dict[str, Any]] = None
    current_group: Optional[Dict[str, Any]] = None
    current_section = ""
    paper_subject = ""
    state = "skip"
    pending_option_images: List[str] = []

    def finish_q(next_num: Optional[int] = None):
        nonlocal current_q, paper_subject
        pending_option_images.clear()
        if current_q is not None:
            if current_q["number"] is None:
                if next_num is not None and next_num > 1:
                    current_q["number"] = next_num - 1
                else:
                    current_q["number"] = 1
            full_txt = " ".join(current_q["body_parts"]).strip()
            if SUBJECT_CHECK_RE.search(full_txt) or (current_q["marks"] == 0 and "ARE YOU SURE YOU HAVE TO WRITE EXAM" in full_txt):
                current_q["subject_check"] = True
                m = SUBJECT_CHECK_RE.search(full_txt)
                if m:
                    current_q["subject_name"] = re.sub(r"\s+", " ", m.group(1)).strip().strip('"')
                    if not paper_subject:
                        paper_subject = current_q["subject_name"]
                elif current_section:
                    current_q["subject_name"] = current_section
            else:
                current_q["subject_check"] = False
            has_content = bool(current_q["body_parts"] or current_q["options"] or current_q["answers"] or current_q["subject_check"])
            if has_content:
                questions.append(current_q)
            current_q = None

    prev_plain = ""
    for line_idx, line in enumerate(all_lines):
        plain = line_text(line)

        next_plain = line_text(all_lines[line_idx + 1]) if line_idx + 1 < len(all_lines) else ""
        if next_plain and re.match(r"^\s*Section\s+Id\s*:", next_plain, re.I):
            if plain and not META_RE.match(plain) and not NOISE_RE.match(plain):
                finish_q()
                current_section = plain.strip()
                current_group = None
                state = "skip"
                prev_plain = plain
                continue

        if re.match(r"^\s*Section\s+Id\s*:", plain, re.I):
            finish_q()
            if prev_plain and not META_RE.match(prev_plain) and not NOISE_RE.match(prev_plain):
                current_section = prev_plain
            current_group = None
            state = "skip"
            prev_plain = plain
            continue

        if plain and len(line.get("tokens", [])) > 0:
            first_tok = line["tokens"][0]
            size = first_tok.get("size") or 10.0
            if size >= 15.0 and not re.match(r"^(Group|Question Paper Preview)\b", plain, re.I) and not META_RE.match(plain):
                finish_q()
                current_section = plain.strip()
                current_group = None
                state = "skip"
                prev_plain = plain
                continue

        m_q = QNUM_RE.search(plain)
        if m_q:
            num = int(m_q.group(1))
            finish_q(next_num=num)
            qid = m_q.group(2)
            raw_type = (m_q.group(3) or "").upper()
            q_dict = {
                "number": num,
                "qid": qid,
                "qtype": raw_type,
                "label": "",
                "marks": 1.0,
                "negative_marks": 0.0,
                "body_parts": [],
                "options": [],
                "answers": [],
                "group_id": None,
                "comprehension_passage": None,
                "section_name": current_section,
                "subject_check": False,
            }
            if current_group:
                if current_group["first"] is not None and current_group["last"] is not None:
                    if current_group["first"] <= num <= current_group["last"]:
                        q_dict["group_id"] = current_group["gid"]
                        q_dict["comprehension_passage"] = " ".join(current_group["passage_parts"]).strip()
                    elif num > current_group["last"]:
                        current_group = None
                elif current_group["first"] is None:
                    q_dict["group_id"] = current_group["gid"]
                    q_dict["comprehension_passage"] = " ".join(current_group["passage_parts"]).strip()

            current_q = q_dict
            state = "qhead"
            m_m = MARKS_RE.search(plain)
            if m_m:
                current_q["marks"] = float(m_m.group(1))
            m_n = NEG_RE.search(plain)
            if m_n:
                current_q["negative_marks"] = float(m_n.group(1))
            continue

        if current_q is None and not questions and not current_group:
            m_m = MARKS_RE.search(plain)
            is_lbl = bool(LABEL_RE.match(plain))
            is_sub = bool(re.search(r"THIS IS QUESTION PAPER FOR THE SUBJECT", plain, re.I))
            is_opt_start = bool(re.match(r"^\s*Options\s*:\s*$", plain, re.I))
            if m_m or is_lbl or is_sub or is_opt_start:
                current_q = {
                    "number": None,
                    "qid": "init_1",
                    "qtype": "MCQ",
                    "label": "",
                    "marks": 1.0,
                    "negative_marks": 0.0,
                    "body_parts": [],
                    "options": [],
                    "answers": [],
                    "group_id": None,
                    "comprehension_passage": None,
                    "section_name": current_section,
                    "subject_check": False,
                }
                if m_m:
                    current_q["marks"] = float(m_m.group(1))
                m_n = NEG_RE.search(plain)
                if m_n:
                    current_q["negative_marks"] = float(m_n.group(1))
                if is_lbl:
                    lm = LABEL_RE.match(plain)
                    if lm:
                        current_q["label"] = lm.group(1).strip()
                    state = "body"
                    continue
                elif is_sub:
                    rendered = render_token_line(line)
                    if rendered:
                        current_q["body_parts"].append(rendered)
                    state = "body"
                    continue
                elif is_opt_start:
                    state = "options"
                    continue
                else:
                    state = "qhead"
                    continue

        m_g = QGROUP_RE.match(plain)
        if m_g:
            finish_q()
            gid = m_g.group(1)
            current_group = {"gid": gid, "first": None, "last": None, "passage_parts": []}
            groups[gid] = current_group
            state = "ghead"
            m_rng = QNUMS_RE.search(plain)
            if m_rng:
                current_group["first"] = int(m_rng.group(1))
                current_group["last"] = int(m_rng.group(2))
            continue

        if state in ("qhead", "ghead"):
            if current_q:
                m_m = MARKS_RE.search(plain)
                if m_m:
                    current_q["marks"] = float(m_m.group(1))
                    continue
                m_n = NEG_RE.search(plain)
                if m_n:
                    current_q["negative_marks"] = float(m_n.group(1))
                    continue
            if current_group:
                m_rng = QNUMS_RE.search(plain)
                if m_rng:
                    current_group["first"] = int(m_rng.group(1))
                    current_group["last"] = int(m_rng.group(2))
                    continue

            lm = LABEL_RE.match(plain)
            if lm:
                label = lm.group(1).strip()
                if state == "ghead" or label.lower() == "comprehension":
                    state = "passage"
                else:
                    if current_q:
                        current_q["label"] = label
                    state = "body"
                continue

            if META_RE.match(plain) or NOISE_RE.match(plain):
                continue

            state = "passage" if state == "ghead" else "body"

        if not plain and line["type"] != "image_block":
            continue
        if NOISE_RE.match(plain):
            continue

        if re.match(r"^\s*Options\s*:\s*$", plain, re.I) and current_q:
            state = "options"
            pending_option_images.clear()
            continue

        if re.match(r"^\s*Possible Answers\s*:", plain, re.I) and current_q:
            state = "answers"
            rest = re.sub(r"^\s*Possible Answers\s*:\s*", "", plain, flags=re.I).strip()
            if rest:
                current_q["answers"].append(rest)
            continue

        if state == "options" and line["type"] == "image_block":
            rendered = render_token_line(line)
            if rendered:
                pending_option_images.append(rendered)
            continue

        om = OPTID_RE.match(plain) if plain else None
        if om and current_q and state in ("options", "option", "body"):
            first_word_color = line["tokens"][0].get("color") if line.get("tokens") else None
            is_correct = is_green_color(first_word_color) or (line.get("icon") == "tick")
            rendered = render_token_line(line)
            opt_text = re.sub(r"^\s*\d{8,}\s*\.\s*", "", rendered).strip()
            if pending_option_images:
                opt_text = f"{' '.join(pending_option_images)} {opt_text}".strip()
                pending_option_images.clear()
            current_q["options"].append({
                "oid": om.group(1),
                "text": opt_text,
                "correct": is_correct
            })
            state = "option"
            continue

        if META_RE.match(plain):
            if state in ("options", "option", "answers"):
                state = "skip"
            continue

        if state == "answers":
            if plain and current_q:
                current_q["answers"].append(plain)
            continue

        if state == "passage":
            if re.match(r"^(Based on the above data, answer the given sub-?questions\.?|Sub\s*questions)$", plain, re.I):
                continue
            rendered = render_token_line(line)
            if current_group and rendered:
                current_group["passage_parts"].append(rendered)
            continue

        if state == "body":
            rendered = render_token_line(line)
            if current_q and rendered:
                current_q["body_parts"].append(rendered)
            continue

        if state == "option":
            rendered = render_token_line(line)
            if current_q and current_q["options"] and rendered:
                current_q["options"][-1]["text"] = f"{current_q['options'][-1]['text']} {rendered}".strip()
            if plain:
                prev_plain = plain
            continue

        if plain:
            prev_plain = plain

    finish_q()

    valid_q_dicts = []
    for q_dict in questions:
        if skip_confirmation and q_dict.get("subject_check"):
            continue
        has_text = bool(" ".join(q_dict.get("body_parts", [])).strip())
        has_opts = bool(q_dict.get("options"))
        has_ans = bool(q_dict.get("answers"))
        if not has_text and not has_opts and not has_ans:
            continue
        valid_q_dicts.append(q_dict)

    conf_indices = [i for i, q in enumerate(valid_q_dicts) if q.get("subject_check")]
    if conf_indices:
        clusters = []
        for i, start_idx in enumerate(conf_indices):
            end_idx = conf_indices[i + 1] if i + 1 < len(conf_indices) else len(valid_q_dicts)
            cluster_qs = valid_q_dicts[start_idx:end_idx]
            sub_name = cluster_qs[0].get("subject_name") or cluster_qs[0].get("section_name") or paper_subject
            clusters.append({
                "subject": sub_name,
                "questions": cluster_qs,
            })
        best_cluster = max(clusters, key=lambda c: len(c["questions"]))
        valid_q_dicts = best_cluster["questions"]
        if best_cluster["subject"]:
            paper_subject = best_cluster["subject"]

    if not paper_subject and valid_q_dicts:
        for q in valid_q_dicts:
            if q.get("section_name"):
                paper_subject = q["section_name"]
                break

    final_questions: List[Question] = []
    idx = 1
    for q_dict in valid_q_dicts:
        label_lower = (q_dict["label"] or "").lower()
        qtype_upper = (q_dict["qtype"] or "").upper()

        if "multiple select" in label_lower or qtype_upper == "MSQ":
            final_type = "multichoice"
        elif "short answer" in label_lower or qtype_upper in ("SA", "NAT", "NUMERIC") or q_dict["answers"]:
            final_type = "numeric"
        else:
            final_type = "MCQ"

        if final_type == "numeric":
            opts = None
            corr_ans = " ".join(q_dict["answers"]).strip() if q_dict["answers"] else ""
        else:
            opts = [opt["text"].strip() for opt in q_dict["options"]]
            corr_list = [opt["text"].strip() for opt in q_dict["options"] if opt["correct"]]
            if final_type == "MCQ":
                corr_ans = corr_list[0] if corr_list else (opts[0] if opts else "")
            else:
                corr_ans = corr_list

        body_text = " ".join(q_dict["body_parts"]).strip()
        comp_passage = q_dict["comprehension_passage"].strip() if q_dict.get("comprehension_passage") else None
        img_tags = re.findall(r"\[IMAGE:\s*([^\]|]+)", body_text + " " + (comp_passage or "") + " " + " ".join(opts or []))

        final_questions.append(
            Question(
                id=idx,
                number=idx,
                original_number=q_dict.get("number"),
                text=body_text,
                type=final_type,
                options=opts,
                correct_answer=corr_ans,
                marks=q_dict["marks"],
                negative_marks=q_dict["negative_marks"],
                images=img_tags,
                image_locations=[],
                comprehension_passage=comp_passage,
                group_id=q_dict.get("group_id"),
                section_name=q_dict.get("section_name") or None,
            )
        )
        idx += 1

    paper_title = paper_subject or Path(pdf_path).stem.replace("_", " ").title()
    total_marks = sum(q.marks for q in final_questions)

    return Paper(
        title=paper_title,
        filename=Path(pdf_path).name,
        total_questions=len(final_questions),
        total_marks=round(total_marks, 2),
        questions=final_questions,
    )

def parse_pdf_to_paper(
    pdf_path: str,
    image_dir: str = "temp/image",
    image_prefix: Optional[str] = "temp/image",
    skip_confirmation: bool = False,
    embed_base64: bool = True,
) -> Paper:
    return parse_with_pdfplumber(
        pdf_path=pdf_path,
        image_dir=image_dir,
        image_prefix=image_prefix,
        skip_confirmation=skip_confirmation,
        embed_base64=embed_base64,
    )
