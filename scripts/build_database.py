import os
import sys
import json
import time
import shutil
import re
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from parser import parse_pdf_to_paper

COURSE_NAMES = {
    "BSCS1001": "Computational Thinking",
    "BSCS1002": "Programming in Python",
    "BSHS1001": "English 1",
    "BSHS1002": "English 2",
    "BSMA1001": "Mathematics for Data Science 1",
    "BSMA1002": "Statistics for Data Science 1",
    "BSMA1003": "Mathematics for Data Science 2",
    "BSMA1004": "Statistics for Data Science 2",
    "BT4001": "Computational Biology",
    "BT4002": "Introduction to Bioinformatics",
    "CS2001": "Database Management Systems",
    "CS2002": "Programming, Data Structures and Algorithms using Python",
    "CS2003": "Application Development 1",
    "CS2004": "Machine Learning Foundations",
    "CS2005": "Programming Concepts using Java",
    "CS2006": "Application Development 2",
    "CS2007": "Machine Learning Techniques",
    "CS2008": "Machine Learning Practice",
    "CS3001": "Software Engineering",
    "CS3002": "Software Testing",
    "CS3003": "AI: Search Methods for Problem Solving",
    "CS3004": "Deep Learning",
    "CS3005": "Programming in C",
    "CS3021": "Computer Architecture",
    "CS3031": "Computer Systems Design",
    "CS4001": "Speech Technology",
    "CS4003": "Reinforcement Learning",
    "CS4010": "Modern Algorithm Design",
    "CS4021": "Advanced Algorithms",
    "CS4022": "Operating Systems",
    "CS4024": "Compiler Design",
    "CS4032": "Cryptography and Cyber Security",
    "DA2001": "Introduction to Deep Learning and Generative AI",
    "DA4001": "Data Visualization",
    "DA5001": "Big Data",
    "DA5002": "Mathematical Foundations of Generative AI",
    "DA5003": "Generative AI",
    "DA5004": "Large Language Models",
    "DA5005": "Information Retrieval",
    "DA5006": "Deep Learning for Computer Vision",
    "DA5007": "Natural Language Processing",
    "DA5013": "Deep Learning Practice",
    "DA5014": "AI in Healthcare",
    "EE4001": "Digital Signal Processing",
    "GN3001": "Strategies for Professional Growth",
    "MA2001": "Linear Algebra",
    "MA3001": "Graph Theory",
    "MA3012": "Mathematical Economics",
    "MA3014": "Operations Research",
    "MS2001": "Business Data Management",
    "MS2002": "Business Analytics",
    "MS3002": "Market Research",
    "MS3033": "Managerial Economics",
    "MS3034": "Financial Forensics",
    "MS4001": "Corporate Finance",
    "MS4002": "Financial Management",
    "MS4003": "Security Analysis and Portfolio Management",
    "MS4023": "Game Theory and Strategy",
    "SE2001": "System Commands",
    "SE2002": "Tools in Data Science"
}

COURSE_LEVELS = {
    "BSCS1001": "Foundation",
    "BSCS1002": "Foundation",
    "BSHS1001": "Foundation",
    "BSHS1002": "Foundation",
    "BSMA1001": "Foundation",
    "BSMA1002": "Foundation",
    "BSMA1003": "Foundation",
    "BSMA1004": "Foundation",
    "MA2001": "Foundation",
    "CS2001": "Diploma in Programming",
    "CS2002": "Diploma in Programming",
    "CS2003": "Diploma in Programming",
    "CS2005": "Diploma in Programming",
    "CS2006": "Diploma in Programming",
    "SE2001": "Diploma in Programming",
    "CS2004": "Diploma in Data Science",
    "CS2007": "Diploma in Data Science",
    "CS2008": "Diploma in Data Science",
    "MS2001": "Diploma in Data Science",
    "MS2002": "Diploma in Data Science",
    "SE2002": "Diploma in Data Science"
}

TERM_MONTHS = {
    "T1": "Jan",
    "T2": "May",
    "T3": "Sep"
}

EXAM_NAMES = {
    "Q1": "Quiz 1",
    "Q2": "Quiz 2",
    "ET": "End Term"
}

SESSION_NAMES = {
    "FN": "Forenoon",
    "AN": "Afternoon",
    "NA": "Standard"
}

def parse_filename_meta(filename: str):
    stem = Path(filename).stem
    parts = stem.split("_")
    code = parts[0].upper() if len(parts) > 0 else "UNKNOWN"
    
    term_part = parts[1] if len(parts) > 1 else ""
    year = 0
    term_month = ""
    term_code = term_part
    m_year = re.search(r"(\d{4})(T[1-3])", term_part, re.IGNORECASE)
    if m_year:
        year = int(m_year.group(1))
        t_key = m_year.group(2).upper()
        term_month = TERM_MONTHS.get(t_key, "")
        term_code = f"{year}{t_key}"
    elif re.match(r"^\d{4}$", term_part):
        year = int(term_part)
        term_code = str(year)

    exam_code = parts[2].upper() if len(parts) > 2 else "EXAM"
    exam_type = EXAM_NAMES.get(exam_code, exam_code)

    session_code = parts[3].upper() if len(parts) > 3 else "NA"
    session = SESSION_NAMES.get(session_code, session_code)

    course_name = COURSE_NAMES.get(code, code)
    level = COURSE_LEVELS.get(code, "Degree")

    slug = stem.lower().replace("_", "-").replace(" ", "-")
    term_str = f"{term_month} {year}".strip() if term_month else str(year)
    display_title = f"{course_name} - {term_str} {exam_type}"
    if session_code in ["FN", "AN"]:
        display_title += f" ({session})"

    return {
        "slug": slug,
        "stem": stem,
        "course_code": code,
        "course_name": course_name,
        "level": level,
        "year": year,
        "term": term_str,
        "term_code": term_code,
        "exam_type": exam_type,
        "session": session,
        "display_title": display_title
    }

def process_single_pdf(args):
    pdf_path_str, images_dir_str, papers_dir_str = args
    pdf_path = Path(pdf_path_str)
    stem = pdf_path.stem
    meta = parse_filename_meta(pdf_path.name)
    json_path = Path(papers_dir_str) / f"{stem}.json"

    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                paper_dict = json.load(f)
            return {
                "success": True,
                "stem": stem,
                "slug": meta["slug"],
                "filename": pdf_path.name,
                "json_file": f"{stem}.json",
                "title": paper_dict.get("title") or meta["display_title"],
                "course_code": meta["course_code"],
                "course_name": meta["course_name"],
                "level": meta["level"],
                "year": meta["year"],
                "term": meta["term"],
                "term_code": meta["term_code"],
                "exam_type": meta["exam_type"],
                "session": meta["session"],
                "total_questions": paper_dict.get("total_questions", 0),
                "total_marks": paper_dict.get("total_marks", 0),
                "paper_dict": paper_dict,
                "cached": True
            }
        except Exception:
            pass

    try:
        paper = parse_pdf_to_paper(
            pdf_path=str(pdf_path),
            image_dir=images_dir_str,
            image_prefix="/data/images",
            skip_confirmation=False,
            embed_base64=False
        )
        paper_dict = paper.model_dump()
        paper_dict["id"] = meta["slug"]
        paper_dict["course_code"] = meta["course_code"]
        paper_dict["course_name"] = meta["course_name"]
        paper_dict["level"] = meta["level"]
        paper_dict["term"] = meta["term"]
        paper_dict["year"] = meta["year"]
        paper_dict["exam_type"] = meta["exam_type"]
        paper_dict["session"] = meta["session"]
        if paper.title and len(paper.title) > 5 and not paper.title.startswith(stem[:6]):
            paper_dict["title"] = paper.title
        else:
            paper_dict["title"] = meta["display_title"]

        return {
            "success": True,
            "stem": stem,
            "slug": meta["slug"],
            "filename": pdf_path.name,
            "json_file": f"{stem}.json",
            "title": paper_dict["title"],
            "course_code": meta["course_code"],
            "course_name": meta["course_name"],
            "level": meta["level"],
            "year": meta["year"],
            "term": meta["term"],
            "term_code": meta["term_code"],
            "exam_type": meta["exam_type"],
            "session": meta["session"],
            "total_questions": paper.total_questions,
            "total_marks": paper.total_marks,
            "paper_dict": paper_dict,
            "cached": False
        }
    except Exception as e:
        return {
            "success": False,
            "stem": stem,
            "filename": pdf_path.name,
            "error": str(e)
        }

def build_database():
    start_time = time.time()
    
    backend_data_dir = BASE_DIR / "data"
    papers_out_dir = backend_data_dir / "papers"
    images_out_dir = backend_data_dir / "images"
    
    papers_out_dir.mkdir(parents=True, exist_ok=True)
    images_out_dir.mkdir(parents=True, exist_ok=True)

    source_dir = BASE_DIR / "temp" / "papers"
    pdf_files = list(source_dir.glob("*.pdf"))
    total_files = len(pdf_files)
    print(f"Starting conversion of {total_files} PDF files...")

    cpu_cores = os.cpu_count() or 4
    num_workers = max(1, cpu_cores - 2)
    print(f"Processing in parallel using {num_workers} worker processes (Cores: {cpu_cores} - 2)...")

    tasks = [(str(f), str(images_out_dir), str(papers_out_dir)) for f in pdf_files]

    catalog_records = []
    success_count = 0
    error_count = 0

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(process_single_pdf, task): task for task in tasks}
        for future in as_completed(futures):
            res = future.result()
            if res["success"]:
                stem = res["stem"]
                paper_json_path = papers_out_dir / f"{stem}.json"
                if not res.get("cached"):
                    with open(paper_json_path, "w", encoding="utf-8") as f:
                        json.dump(res["paper_dict"], f, indent=2)

                catalog_records.append({
                    "id": res["slug"],
                    "filename": res["filename"],
                    "json_file": res["json_file"],
                    "title": res["title"],
                    "course_code": res["course_code"],
                    "course_name": res["course_name"],
                    "level": res["level"],
                    "year": res["year"],
                    "term": res["term"],
                    "term_code": res["term_code"],
                    "exam_type": res["exam_type"],
                    "session": res["session"],
                    "total_questions": res["total_questions"],
                    "total_marks": res["total_marks"],
                    "json_url": f"/data/papers/{stem}.json"
                })
                success_count += 1
            else:
                error_count += 1
                print(f"Error parsing {res['filename']}: {res['error']}")

            processed = success_count + error_count
            if processed % 100 == 0 or processed == total_files:
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                print(f"[{processed}/{total_files}] processed ({rate:.1f} files/sec, {elapsed:.1f}s elapsed)...")

    catalog_records.sort(key=lambda x: (
        -x["year"],
        x["course_code"],
        x["term_code"],
        x["exam_type"]
    ))

    catalog_path = backend_data_dir / "catalog.json"
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog_records, f, indent=2)

    course_stats = {}
    for r in catalog_records:
        code = r["course_code"]
        if code not in course_stats:
            course_stats[code] = {
                "code": code,
                "name": r["course_name"],
                "level": r["level"],
                "total_papers": 0,
                "years": set(),
                "terms": set(),
                "exam_types": set()
            }
        cs = course_stats[code]
        cs["total_papers"] += 1
        if r["year"]:
            cs["years"].add(r["year"])
        if r["term"]:
            cs["terms"].add(r["term"])
        if r["exam_type"]:
            cs["exam_types"].add(r["exam_type"])

    courses_list = []
    for code, cs in sorted(course_stats.items(), key=lambda x: (x[1]["level"], x[0])):
        courses_list.append({
            "code": cs["code"],
            "name": cs["name"],
            "level": cs["level"],
            "total_papers": cs["total_papers"],
            "years": sorted(list(cs["years"])),
            "terms": sorted(list(cs["terms"])),
            "exam_types": sorted(list(cs["exam_types"]))
        })

    courses_path = backend_data_dir / "courses.json"
    with open(courses_path, "w", encoding="utf-8") as f:
        json.dump(courses_list, f, indent=2)

    total_time = time.time() - start_time
    print(f"Finished build in {total_time:.2f} seconds!")
    print(f"Total Successful: {success_count}, Errors: {error_count}")
    print(f"Catalog saved to {catalog_path}")
    print(f"Courses dictionary saved to {courses_path}")

if __name__ == "__main__":
    build_database()

