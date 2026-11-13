import io
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from PIL import Image, ImageChops, ImageOps
import pymupdf as fitz

try:
    from backend.models import Paper, Question
except ModuleNotFoundError:
    from models import Paper, Question

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


def _is_icon_rect(r: fitz.Rect) -> bool:
    return r.width <= 16.0 and r.height <= 16.0 and abs(r.width - r.height) < 3.0


def _is_green(c: int) -> bool:
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    return g > 90 and g > r + 35 and g > b + 35


def _classify_icon(img: Image.Image) -> Optional[str]:
    try:
        arr = np.array(img.convert("RGBA"))
        mask = (arr[:, :, 3] > 50) & ((arr[:, :, 0] < 240) | (arr[:, :, 1] < 240) | (arr[:, :, 2] < 240))
        if not mask.any():
            return None
        mean_rgb = arr[mask][:, :3].mean(axis=0)
        return "tick" if mean_rgb[1] > mean_rgb[0] else "cross"
    except Exception:
        return None


class VisualLine:
    def __init__(self, page: int, frags: list, y0: float, y1: float):
        self.page = page
        self.frags = frags
        self.y0 = y0
        self.y1 = y1

    @property
    def plain(self) -> str:
        return "".join(f["text"] for f in self.frags if f["kind"] == "t")

    @property
    def texts(self):
        return [f for f in self.frags if f["kind"] == "t"]

    @property
    def images(self):
        return [f for f in self.frags if f["kind"] == "i"]

    @property
    def bold(self) -> bool:
        t = [f for f in self.texts if f["text"].strip()]
        return bool(t) and all(f["flags"] & 16 for f in t)

    @property
    def main_size(self) -> float:
        best: Dict[float, int] = {}
        for f in self.texts:
            n = len(f["text"].strip())
            if n:
                best[round(f["size"], 1)] = best.get(round(f["size"], 1), 0) + n
        return max(best, key=best.get) if best else 0.0


class ImageStore:
    def __init__(self, doc: fitz.Document, outdir: Optional[str], image_prefix: str = "temp/image"):
        self.doc = doc
        self.outdir = Path(outdir) if outdir else None
        self.image_prefix = image_prefix.rstrip("/")
        self.done: Dict[int, str] = {}
        self.icon_classes: Dict[int, str] = {}
        if self.outdir:
            self.outdir.mkdir(parents=True, exist_ok=True)

    def get_icon(self, xref: int) -> Optional[str]:
        if xref in self.icon_classes:
            return self.icon_classes[xref]
        try:
            info = self.doc.extract_image(xref)
            im = Image.open(io.BytesIO(info["image"]))
            cls = _classify_icon(im)
            self.icon_classes[xref] = cls
            return cls
        except Exception:
            return None

    def save_image(self, xref: int) -> str:
        if xref in self.done:
            return self.done[xref]
        ext = "png"
        filename = f"img_{len(self.done) + 1:04d}.{ext}"
        self.done[xref] = filename
        if self.outdir:
            out_file = self.outdir / filename
            try:
                info = self.doc.extract_image(xref)
                im = Image.open(io.BytesIO(info["image"]))
                im.load()
                if info.get("smask"):
                    m = Image.open(io.BytesIO(self.doc.extract_image(info["smask"])["image"])).convert("L")
                    if m.size != im.size:
                        m = m.resize(im.size)
                    im = im.convert("RGBA")
                    im.putalpha(m)
                if im.mode in ("RGBA", "LA", "P"):
                    im = im.convert("RGBA")
                    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                    im = Image.alpha_composite(bg, im)
                im = im.convert("RGB")
                ow, oh = im.size
                diff = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255)))
                box = ImageOps.grayscale(diff).point(lambda v: 255 if v > 24 else 0).getbbox()
                if box:
                    l, t, r, b = max(0, box[0] - 1), max(0, box[1] - 1), min(ow, box[2] + 1), min(oh, box[3] + 1)
                    if (r - l) * (b - t) < ow * oh:
                        im = im.crop((l, t, r, b))
                im.save(out_file, "PNG", optimize=True)
            except Exception:
                pix = fitz.Pixmap(self.doc, xref)
                if pix.n - pix.alpha > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                if pix.alpha:
                    pix = fitz.Pixmap(pix, 0)
                pix.save(str(out_file))
        return filename

    def render_block(self, filename: str) -> str:
        rel = f"{self.image_prefix}/{filename}" if self.image_prefix else filename
        return f"[IMAGE: {rel}]"


def page_visual_lines(page: fitz.Page, pno: int, images: ImageStore) -> List[VisualLine]:
    els = []
    d = page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_MEDIABOX_CLIP)
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for ln in b.get("lines", []):
            for s in ln.get("spans", []):
                chars = s.get("chars") or []
                if not chars:
                    continue
                pieces, cur, last_x1 = [], [], None
                for ch in chars:
                    c = ch["c"]
                    if c.strip() and last_x1 is not None and ch["bbox"][0] - last_x1 > 0.8 * s["size"] and cur:
                        pieces.append(cur)
                        cur = []
                    cur.append(ch)
                    if c.strip():
                        last_x1 = ch["bbox"][2]
                if cur:
                    pieces.append(cur)
                for pc in pieces:
                    text = "".join(ch["c"] for ch in pc)
                    x0 = min(ch["bbox"][0] for ch in pc)
                    x1 = max(ch["bbox"][2] for ch in pc)
                    r = fitz.Rect(x0, s["bbox"][1], x1, s["bbox"][3])
                    els.append(dict(kind="t", text=text, bbox=r, color=s["color"], size=s["size"],
                                    flags=s["flags"], oy=s["origin"][1]))

    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info["bbox"]) & page.rect
        if r.is_empty or r.width < 1 or r.height < 1:
            continue
        xref = info["xref"]
        if _is_icon_rect(r):
            icon_cls = images.get_icon(xref)
            els.append(dict(kind="icon", cls=icon_cls, bbox=r))
        else:
            els.append(dict(kind="i", xref=xref, bbox=r))

    els.sort(key=lambda e: (round(e["bbox"].y0, 1), e["bbox"].x0))
    lines: List[dict] = []
    block_min_h = 30.0
    for e in els:
        r = e["bbox"]
        big = (e["kind"] == "i" and r.height >= block_min_h)
        placed = False
        if not big:
            for L in lines[-3:][::-1]:
                if L["big"]:
                    continue
                a0, a1 = L["anchor"]
                ov = min(a1, r.y1) - max(a0, r.y0)
                if ov >= 0.5 * min(a1 - a0, r.height):
                    L["frags"].append(e)
                    L["y0"], L["y1"] = min(L["y0"], r.y0), max(L["y1"], r.y1)
                    placed = True
                    break
        if not placed:
            lines.append(dict(frags=[e], anchor=(r.y0, r.y1), y0=r.y0, y1=r.y1, big=big))

    for i, L in enumerate(lines):
        if not L["big"]:
            continue
        img_bbox = L["frags"][0]["bbox"]
        for M in lines[i + 1:i + 4]:
            if M["big"] or M.get("merged"):
                continue
            cy = (M["anchor"][0] + M["anchor"][1]) / 2
            texts = [f for f in M["frags"] if f["kind"] == "t" and f["text"].strip()]
            if img_bbox.y0 <= cy <= img_bbox.y1 + 2 and texts and OPTID_RE.match(texts[0]["text"]) \
                    and texts[0]["bbox"].x1 <= img_bbox.x0 + 2:
                L["frags"].extend(M["frags"])
                L["y0"], L["y1"] = min(L["y0"], M["y0"]), max(L["y1"], M["y1"])
                L["big"] = False
                M["merged"] = True
                break
    lines = [L for L in lines if not L.get("merged")]

    out: List[VisualLine] = []
    for L in lines:
        fr = sorted(L["frags"], key=lambda f: f["bbox"].x0)
        if not any((f["kind"] in ("i", "icon")) or (f["kind"] == "t" and f["text"].strip()) for f in fr):
            continue
        out.append(VisualLine(pno, fr, L["y0"], L["y1"]))
    out.sort(key=lambda l: l.y0)
    return out


def line_to_runs(line: VisualLine, images: ImageStore, skip_opt_id: Optional[str] = None) -> List[str]:
    parts: List[str] = []
    frags = list(line.frags)
    if skip_opt_id is not None:
        for i, f in enumerate(frags):
            if f["kind"] == "t" and f["text"].strip():
                rest = f["text"][len(skip_opt_id):] if f["text"].startswith(skip_opt_id) else OPTID_RE.sub("", f["text"], count=1)
                frags[i] = dict(f, text=rest)
                break
    for f in frags:
        if f["kind"] == "t":
            t = f["text"]
            if t:
                parts.append(t)
        elif f["kind"] == "i":
            name = images.save_image(f["xref"])
            parts.append(images.render_block(name))
    return parts


class QuestionItem:
    def __init__(self, number: int, qid: str, qtype: str = ""):
        self.number = number
        self.qid = qid
        self.label = ""
        self.qtype = qtype
        self.marks = 1.0
        self.negative_marks = 0.0
        self.body_parts: List[str] = []
        self.options: List[Dict[str, Any]] = []
        self.answers: List[str] = []
        self.group_id: Optional[str] = None
        self.comprehension_passage: Optional[str] = None
        self.section_name: Optional[str] = None
        self.subject_check: bool = False
        self.images: List[str] = []


class ComprehensionGroup:
    def __init__(self, gid: str):
        self.gid = gid
        self.first: Optional[int] = None
        self.last: Optional[int] = None
        self.passage_parts: List[str] = []


def parse_pdf_to_paper(
    pdf_path: str,
    image_dir: str = "temp/image",
    image_prefix: Optional[str] = "temp/image",
    skip_confirmation: bool = True,
) -> Paper:
    prefix = image_prefix or "temp/image"
    doc = fitz.open(pdf_path)
    images = ImageStore(doc, image_dir, image_prefix=prefix)

    questions: List[QuestionItem] = []
    groups: Dict[str, ComprehensionGroup] = {}
    current_q: Optional[QuestionItem] = None
    current_group: Optional[ComprehensionGroup] = None
    current_section = ""
    paper_subject = ""
    state = "skip"

    def finish_current_question():
        nonlocal current_q
        if current_q is not None:
            full_text = " ".join(current_q.body_parts).strip()
            if SUBJECT_CHECK_RE.search(full_text):
                current_q.subject_check = True
                m = SUBJECT_CHECK_RE.search(full_text)
                if m:
                    nonlocal paper_subject
                    paper_subject = re.sub(r"\s+", " ", m.group(1)).strip()
            questions.append(current_q)
            current_q = None

    for pno, page in enumerate(doc):
        lines = page_visual_lines(page, pno, images)
        for line in lines:
            plain = line.plain.strip()

            # Section header
            if plain and line.main_size >= 15.5 and line.bold and not line.images \
                    and not re.match(r"^Group\b", plain, re.I) and not META_RE.match(plain):
                finish_current_question()
                current_section = plain
                state = "skip"
                continue

            # Question Header
            m_q = QNUM_RE.search(plain)
            if m_q:
                finish_current_question()
                num = int(m_q.group(1))
                qid = m_q.group(2)
                raw_type = (m_q.group(3) or "").upper()
                q = QuestionItem(number=num, qid=qid, qtype=raw_type)
                q.section_name = current_section

                if current_group and (current_group.first is None or current_group.first <= num <= (current_group.last or num)):
                    q.group_id = current_group.gid
                    q.comprehension_passage = " ".join(current_group.passage_parts).strip()

                current_q = q
                state = "qhead"

                m_m = MARKS_RE.search(plain)
                if m_m:
                    current_q.marks = float(m_m.group(1))
                m_n = NEG_RE.search(plain)
                if m_n:
                    current_q.negative_marks = float(m_n.group(1))
                continue

            # Comprehension Group Header
            m_g = QGROUP_RE.match(plain)
            if m_g:
                finish_current_question()
                gid = m_g.group(1)
                current_group = ComprehensionGroup(gid=gid)
                groups[gid] = current_group
                state = "ghead"
                m_rng = QNUMS_RE.search(plain)
                if m_rng:
                    current_group.first, current_group.last = int(m_rng.group(1)), int(m_rng.group(2))
                continue

            if state in ("qhead", "ghead"):
                if current_q:
                    m_m = MARKS_RE.search(plain)
                    if m_m:
                        current_q.marks = float(m_m.group(1))
                    m_n = NEG_RE.search(plain)
                    if m_n:
                        current_q.negative_marks = float(m_n.group(1))
                if current_group:
                    m_rng = QNUMS_RE.search(plain)
                    if m_rng:
                        current_group.first, current_group.last = int(m_rng.group(1)), int(m_rng.group(2))

                lm = LABEL_RE.match(plain)
                if lm:
                    label = lm.group(1).strip()
                    if state == "ghead" or label.lower() == "comprehension":
                        state = "passage"
                    else:
                        if current_q:
                            current_q.label = label
                        state = "body"
                continue

            if not plain and not line.images:
                continue
            if NOISE_RE.match(plain):
                continue

            if re.match(r"^\s*Options\s*:\s*$", plain, re.I) and current_q:
                state = "options"
                continue

            if re.match(r"^\s*Possible Answers\s*:", plain, re.I) and current_q:
                state = "answers"
                rest = re.sub(r"^\s*Possible Answers\s*:\s*", "", plain, flags=re.I).strip()
                if rest:
                    current_q.answers.append(rest)
                continue

            first_text = next((f for f in line.texts if f["text"].strip()), None)
            om = OPTID_RE.match(first_text["text"]) if first_text else None
            if om and current_q and state in ("options", "option", "body"):
                is_green = _is_green(first_text["color"])
                has_tick = any(f.get("kind") == "icon" and f.get("cls") == "tick" for f in line.frags)
                runs = line_to_runs(line, images, skip_opt_id=first_text["text"][:om.end()])
                current_q.options.append({
                    "oid": om.group(1),
                    "parts": runs,
                    "correct": is_green or has_tick
                })
                state = "option"
                continue

            if META_RE.match(plain):
                state = "skip"
                continue

            if state == "answers":
                if plain and current_q:
                    current_q.answers.append(plain)
                continue

            if state == "passage":
                if re.match(r"^(Based on the above data, answer the given sub-?questions\.?|Sub\s*questions)$", plain, re.I):
                    continue
                runs = line_to_runs(line, images)
                if current_group and runs:
                    current_group.passage_parts.extend(runs)
                continue

            if state == "body":
                runs = line_to_runs(line, images)
                if current_q and runs:
                    current_q.body_parts.extend(runs)
                continue

            if state == "option":
                runs = line_to_runs(line, images)
                if current_q and current_q.options and runs:
                    current_q.options[-1]["parts"].extend(runs)
                continue

    finish_current_question()
    doc.close()

    # Reindex and construct Question models
    final_questions: List[Question] = []
    reindexed_idx = 1
    for q_item in questions:
        if skip_confirmation and q_item.subject_check:
            continue

        label_lower = (q_item.label or "").lower()
        qtype_upper = (q_item.qtype or "").upper()

        if "multiple select" in label_lower or qtype_upper == "MSQ":
            final_type = "multichoice"
        elif "short answer" in label_lower or qtype_upper in ("SA", "NAT", "NUMERIC") or q_item.answers:
            final_type = "numeric"
        else:
            final_type = "MCQ"

        opts: Optional[List[str]] = None
        corr_ans: Optional[Union[str, List[str], float]] = None

        if final_type == "numeric":
            opts = None
            corr_ans = " ".join(q_item.answers).strip() if q_item.answers else ""
        else:
            opts = [" ".join(opt["parts"]).strip() for opt in q_item.options]
            corr_list = [" ".join(opt["parts"]).strip() for opt in q_item.options if opt["correct"]]
            if final_type == "MCQ":
                corr_ans = corr_list[0] if corr_list else (opts[0] if opts else "")
            else:
                corr_ans = corr_list

        body_text = " ".join(q_item.body_parts).strip()
        comp_passage = q_item.comprehension_passage.strip() if q_item.comprehension_passage else None

        # Collect embedded image tags
        img_tags = re.findall(r"\[IMAGE:\s*([^\]]+)\]", body_text + " " + (comp_passage or "") + " " + " ".join(opts or []))

        final_questions.append(
            Question(
                id=reindexed_idx,
                number=reindexed_idx,
                text=body_text,
                type=final_type,
                options=opts,
                correct_answer=corr_ans,
                marks=q_item.marks,
                negative_marks=q_item.negative_marks,
                images=img_tags,
                image_locations=[],
                comprehension_passage=comp_passage,
                group_id=q_item.group_id,
                section_name=q_item.section_name or None,
            )
        )
        reindexed_idx += 1

    paper_title = paper_subject or Path(pdf_path).stem.replace("_", " ").title()
    total_marks = sum(q.marks for q in final_questions)

    return Paper(
        title=paper_title,
        filename=Path(pdf_path).name,
        total_questions=len(final_questions),
        total_marks=round(total_marks, 2),
        questions=final_questions,
    )
