import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_IMAGES_DIR = BASE_DIR / "data" / "images"
TEMP_IMAGES_DIR = BASE_DIR / "backend" / "temp" / "image"
ROOT_TEMP_IMAGES_DIR = BASE_DIR / "temp" / "image"


def escape_latex(text: str) -> str:
    if not text:
        return ""
    parts = text.split("$")
    escaped = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            escaped.append(part)
        else:
            p = part
            p = p.replace("\\", "\\textbackslash{}")
            p = p.replace("&", "\\&")
            p = p.replace("%", "\\%")
            p = p.replace("#", "\\#")
            p = p.replace("_", "\\_")
            p = p.replace("{", "\\{")
            p = p.replace("}", "\\}")
            p = p.replace("~", "\\textasciitilde{}")
            p = p.replace("^", "\\textasciicircum{}")
            p = p.replace("<", "$<$")
            p = p.replace(">", "$>$")
            escaped.append(p)
    return "$".join(escaped)


def find_image_file(src_clean: str) -> Path | None:
    filename = Path(src_clean).name
    candidates = [
        DATA_IMAGES_DIR / filename,
        TEMP_IMAGES_DIR / filename,
        ROOT_TEMP_IMAGES_DIR / filename,
    ]
    stem = Path(filename).stem
    for ext in [".webp", ".png", ".jpg", ".jpeg"]:
        candidates.append(DATA_IMAGES_DIR / f"{stem}{ext}")
        candidates.append(TEMP_IMAGES_DIR / f"{stem}{ext}")
        candidates.append(ROOT_TEMP_IMAGES_DIR / f"{stem}{ext}")

    for c in candidates:
        if c.is_file():
            return c
    return None


def process_text_with_images(
    text: str,
    temp_dir: str,
    img_counter: list[int]
) -> str:
    if not text:
        return ""

    pattern = re.compile(r"\[IMAGE:\s*([^\]]+)\]")
    matches = list(pattern.finditer(text))
    if not matches:
        return escape_latex(text).replace("\n", "\n\n")

    segments = pattern.split(text)
    out: list[str] = []

    for i, seg in enumerate(segments):
        out.append(escape_latex(seg))
        if i < len(matches):
            raw = matches[i].group(1).strip()
            parts = raw.split("|")
            src = parts[0].strip()
            is_block = len(parts) > 1 and parts[1].strip().lower() == "block"
            src_clean = src.replace("/data/images/", "").replace("data/images/", "")

            disk_path = find_image_file(src_clean)
            if disk_path:
                img_counter[0] += 1
                out_name = f"img_{img_counter[0]}.png"
                out_path = Path(temp_dir) / out_name
                try:
                    with Image.open(disk_path) as im:
                        im.convert("RGBA").save(out_path, "PNG")
                    if is_block:
                        out.append(
                            f"\n\\begin{{center}}\\includegraphics[max width=0.88\\linewidth,max height=0.35\\textheight,keepaspectratio]{{{out_name}}}\\end{{center}}\n"
                        )
                    else:
                        out.append(
                            f"\\raisebox{{-0.2\\height}}{{\\includegraphics[height=1.25em,keepaspectratio]{{{out_name}}}}}"
                        )
                except Exception:
                    out.append(f" [Diagram: {escape_latex(src_clean)}] ")
            else:
                out.append(f" [Diagram: {escape_latex(src_clean)}] ")

    return "".join(out).replace("\n\n\n", "\n\n")


def format_correct_answer(q: dict) -> str:
    ans = q.get("correct_answer")
    if ans is None or ans == "":
        return "Not specified in official key"

    options = q.get("options") or []

    def get_letter(val: str) -> str | None:
        val_clean = str(val).strip().lower()
        for idx, opt in enumerate(options):
            if opt.strip().lower() == val_clean:
                return chr(65 + idx)
        return None

    if isinstance(ans, list):
        items = []
        for a in ans:
            letter = get_letter(str(a))
            items.append(f"({letter}) {escape_latex(str(a))}" if letter else escape_latex(str(a)))
        return ", ".join(items)

    letter = get_letter(str(ans))
    if letter:
        return f"({letter}) {escape_latex(str(ans))}"
    return escape_latex(str(ans))


def is_option_correct(q: dict, opt_text: str) -> bool:
    ans = q.get("correct_answer")
    if ans is None:
        return False
    target = opt_text.strip().lower()
    if isinstance(ans, list):
        return any(str(a).strip().lower() == target for a in ans)
    return str(ans).strip().lower() == target


def generate_latex_source(
    paper: dict,
    catalog_item: dict | None = None,
    temp_dir: str | None = None
) -> str:
    item = catalog_item or {}
    course_name = item.get("course_name") or paper.get("title") or "IITM BS Examination"
    course_code = item.get("course_code") or ""
    term = item.get("term") or ""
    year = str(item.get("year") or "")
    exam_type = item.get("exam_type") or "Term Exam"
    total_marks = str(paper.get("total_marks") or item.get("total_marks") or 0)
    questions = paper.get("questions") or []
    total_q = len(questions)

    work_dir = temp_dir or tempfile.gettempdir()
    img_counter = [0]

    header_title = escape_latex(course_name)
    sub_title = escape_latex(f"{course_code} - {exam_type} {term} {year}".strip())

    tex: list[str] = [
        r"\documentclass[11pt,a4paper]{article}",
        r"\usepackage[margin=18mm,top=22mm,bottom=22mm,headheight=14pt]{geometry}",
        r"\usepackage{amsmath,amssymb}",
        r"\usepackage{graphicx}",
        r"\usepackage[export]{adjustbox}",
        r"\usepackage{enumitem}",
        r"\usepackage{fancyhdr}",
        r"\usepackage{tcolorbox}",
        r"\usepackage{xcolor}",
        r"\usepackage{booktabs}",
        r"\usepackage{needspace}",
        r"\usepackage{lastpage}",
        r"\usepackage{hyperref}",
        r"\hypersetup{colorlinks=true,linkcolor=teal!80!black,urlcolor=teal!80!black}",
        r"\pagestyle{fancy}",
        r"\fancyhf{}",
        f"\\lhead{{\\textsf{{\\footnotesize IIT Madras BS Degree - {escape_latex(course_code)}}}}}",
        f"\\rhead{{\\textsf{{\\footnotesize {escape_latex(exam_type)} {escape_latex(str(year))}}}}}",
        r"\cfoot{\textsf{\footnotesize Page \thepage\ of \pageref{LastPage}}}",
        r"\renewcommand{\headrulewidth}{0.4pt}",
        r"\renewcommand{\footrulewidth}{0.4pt}",
        r"\begin{document}",
        r"\begin{center}",
        r"{\Large\textbf{INDIAN INSTITUTE OF TECHNOLOGY MADRAS}}\\[2pt]",
        r"{\large\textbf{BS Degree in Data Science and Applications}}\\[6pt]",
        f"{{\\LARGE\\textbf{{{header_title}}}}}\\\\[4pt]",
        f"{{\\large\\textsf{{{sub_title}}}}}\\\\[8pt]",
        r"\end{center}",
        r"\noindent\rule{\textwidth}{1.2pt}\\[6pt]",
        r"\noindent",
        r"\begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}lll}",
        f"\\textbf{{Course Code:}} {escape_latex(course_code)} & \\textbf{{Exam Type:}} {escape_latex(exam_type)} & \\textbf{{Total Marks:}} {escape_latex(total_marks)} \\\\",
        f"\\textbf{{Term / Year:}} {escape_latex(term)} {escape_latex(str(year))} & \\textbf{{Questions:}} {total_q} & \\textbf{{Status:}} Official Solutions Paper \\\\",
        r"\end{tabular*}",
        r"\\[6pt]\noindent\rule{\textwidth}{0.6pt}\vspace{10pt}",
    ]

    for idx, q in enumerate(questions):
        q_num = q.get("number") or (idx + 1)
        marks = q.get("marks", 1.0)
        neg = q.get("negative_marks", 0.0)
        marks_str = f"{marks} Mark" if marks == 1 else f"{marks} Marks"
        if neg > 0:
            marks_str += f", -{neg}"
        q_type = q.get("type") or "MCQ"

        sec = q.get("section_name")
        if sec and (idx == 0 or questions[idx - 1].get("section_name") != sec):
            tex.append(
                f"\n\\section*{{Section: {escape_latex(sec)}}}\n\\vspace{{-4pt}}\\hrule\\vspace{{8pt}}\n"
            )

        tex.append(r"\needspace{4\baselineskip}")
        tex.append(
            f"\\noindent\\textbf{{\\large Q.{q_num}}} \\quad \\textsf{{\\small [{escape_latex(q_type)}]}} \\hfill \\textsf{{\\small [{escape_latex(marks_str)}]}}\\\\[4pt]"
        )

        passage = q.get("comprehension_passage")
        if passage and passage.strip():
            tex.append(
                r"\begin{tcolorbox}[colback=gray!5!white,colframe=gray!40!black,arc=1.5mm,boxrule=0.5pt,title=\textbf{Comprehension / Reference Data},fonttitle=\small\sffamily]"
            )
            tex.append(process_text_with_images(passage, work_dir, img_counter))
            tex.append(r"\end{tcolorbox}" + "\n")

        q_text = process_text_with_images(q.get("text", ""), work_dir, img_counter)
        tex.append(f"\\noindent {q_text}\\\\[6pt]\n")

        options = q.get("options") or []
        if options:
            tex.append(r"\begin{enumerate}[label=\textbf{(\Alph*)},itemsep=3pt,topsep=2pt,leftmargin=20pt]")
            for opt in options:
                is_correct = is_option_correct(q, opt)
                opt_body = process_text_with_images(opt, work_dir, img_counter)
                if is_correct:
                    tex.append(
                        f"\\item {opt_body} \\quad \\textcolor{{teal!80!black}}{{\\textbf{{\\checkmark\\ Correct}}}}"
                    )
                else:
                    tex.append(f"\\item {opt_body}")
            tex.append(r"\end{enumerate}" + "\n")

        ans_str = format_correct_answer(q)
        tex.append(
            r"\begin{tcolorbox}[colback=teal!6!white,colframe=teal!60!black,arc=1.2mm,boxrule=0.6pt,top=2pt,bottom=2pt,left=4pt,right=4pt]"
        )
        tex.append(f"\\textbf{{\\textcolor{{teal!80!black}}{{\\checkmark\\ Verified Answer:}}}} \\quad {ans_str}")
        tex.append(r"\end{tcolorbox}" + "\n")

        tex.append(r"\vspace{6pt}\noindent\dotfill\vspace{8pt}" + "\n")

    tex.append(r"\pagebreak")
    tex.append(r"\section*{Answer Key Summary Table}")
    tex.append(r"\noindent\rule{\textwidth}{0.8pt}\\[6pt]")
    tex.append(r"\begin{center}")
    tex.append(r"\begin{tabular*}{\textwidth}{|c|c|c|p{8.5cm}|}")
    tex.append(r"\hline")
    tex.append(r"\textbf{Q\#} & \textbf{Type} & \textbf{Marks} & \textbf{Correct Answer} \\")
    tex.append(r"\hline")

    for idx, q in enumerate(questions):
        q_num = q.get("number") or (idx + 1)
        q_type = escape_latex(q.get("type") or "MCQ")
        q_marks = escape_latex(str(q.get("marks", 1)))
        ans_clean = format_correct_answer(q)
        tex.append(f"Q.{q_num} & {q_type} & {q_marks} & {ans_clean} \\\\")
        tex.append(r"\hline")

    tex.append(r"\end{tabular*}")
    tex.append(r"\end{center}")
    tex.append(r"\end{document}")

    return "\n".join(tex)


def compile_paper_to_pdf(
    paper: dict,
    catalog_item: dict | None = None
) -> bytes:
    with tempfile.TemporaryDirectory() as td:
        tex_source = generate_latex_source(paper, catalog_item, temp_dir=td)
        tex_file = Path(td) / "paper.tex"
        tex_file.write_text(tex_source, encoding="utf-8")

        cmd = ["pdflatex", "-interaction=nonstopmode", "paper.tex"]
        subprocess.run(cmd, cwd=td, capture_output=True, text=True, check=False)
        subprocess.run(cmd, cwd=td, capture_output=True, text=True, check=False)

        pdf_file = Path(td) / "paper.pdf"
        if not pdf_file.is_file() or pdf_file.stat().st_size == 0:
            log_file = Path(td) / "paper.log"
            log_content = log_file.read_text(encoding="utf-8", errors="ignore") if log_file.is_file() else "No log"
            tail = "\n".join(log_content.splitlines()[-40:])
            raise RuntimeError(f"pdflatex compilation failed:\n{tail}")

        return pdf_file.read_bytes()

