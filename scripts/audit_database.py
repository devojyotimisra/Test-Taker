import json
import re
import sys
from pathlib import Path
from collections import Counter
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PAPERS_DIR = DATA_DIR / "papers"
IMAGES_DIR = DATA_DIR / "images"
CATALOG_PATH = DATA_DIR / "catalog.json"
COURSES_PATH = DATA_DIR / "courses.json"

TAG_REGEX = re.compile(r"\[IMAGE:\s*([^\]|]+)(?:\|[^\]]*)?\]")

def run_audit():
    if not PAPERS_DIR.is_dir() or not IMAGES_DIR.is_dir():
        print(f"Error: Required directories missing in {DATA_DIR}")
        sys.exit(1)

    json_files = sorted(list(PAPERS_DIR.glob("*.json")))
    total_papers = len(json_files)
    total_images_on_disk = len(list(IMAGES_DIR.glob("*.webp")))
    print(f"Auditing {total_papers} papers and {total_images_on_disk} images...")

    total_questions = 0
    empty_papers = []
    corrupted_json_papers = []
    missing_image_files = set()
    corrupt_image_files = set()
    all_referenced_images = set()
    image_cache = {}

    def verify_image(img_rel_path, source_paper):
        fname = Path(img_rel_path.strip()).name
        if fname in image_cache:
            status = image_cache[fname]
            if status == "missing":
                missing_image_files.add(fname)
            elif status == "corrupt":
                corrupt_image_files.add(fname)
            return

        disk_path = IMAGES_DIR / fname
        if not disk_path.is_file():
            image_cache[fname] = "missing"
            missing_image_files.add(fname)
            return

        if disk_path.stat().st_size == 0:
            image_cache[fname] = "corrupt"
            corrupt_image_files.add(fname)
            return

        try:
            with Image.open(disk_path) as img:
                img.verify()
            image_cache[fname] = "ok"
        except Exception:
            image_cache[fname] = "corrupt"
            corrupt_image_files.add(fname)

    for jf in json_files:
        try:
            with open(jf, "r", encoding="utf-8") as f:
                paper_data = json.load(f)
        except Exception as e:
            corrupted_json_papers.append((jf.name, str(e)))
            continue

        questions = paper_data.get("questions", [])
        if not questions:
            empty_papers.append(jf.name)
            continue

        total_questions += len(questions)

        for q in questions:
            q_text = q.get("text", "") or ""
            q_opts = q.get("options") or []
            q_passage = q.get("comprehension_passage") or ""
            q_images = q.get("images") or []

            for src in [q_text, q_passage] + q_opts:
                if not src:
                    continue
                for t in TAG_REGEX.findall(src):
                    verify_image(t, jf.name)
                    all_referenced_images.add(Path(t.strip()).name)

            for img_path in q_images:
                verify_image(img_path, jf.name)
                all_referenced_images.add(Path(img_path.strip()).name)

    cat_count = 0
    cat_missing = 0
    if CATALOG_PATH.is_file():
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            cat = json.load(f)
        cat_count = len(cat)
        cat_missing = sum(1 for item in cat if not (PAPERS_DIR / item.get("json_file", "")).is_file())

    courses_count = 0
    if COURSES_PATH.is_file():
        with open(COURSES_PATH, "r", encoding="utf-8") as f:
            courses_count = len(json.load(f))

    print(f"Papers: {total_papers} valid, {len(empty_papers)} empty, {len(corrupted_json_papers)} corrupt")
    print(f"Questions: {total_questions} total across {courses_count} courses")
    print(f"Images: {len(all_referenced_images)} verified, {len(missing_image_files)} missing, {len(corrupt_image_files)} corrupt")
    print(f"Catalog: {cat_count} entries, {cat_missing} missing files")

if __name__ == "__main__":
    run_audit()
