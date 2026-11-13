import json
import os
import shutil
import sys
from pathlib import Path

def get_downloads_dir() -> Path:
    if sys.platform == "win32":
        return Path(os.environ.get("USERPROFILE", "")) / "Downloads" / "TestTaker_Papers"
    return Path.home() / "Downloads" / "TestTaker_Papers"

def import_papers(source_dir: Path, target_dir: Path, catalog_file: Path):
    if not source_dir.is_dir():
        print(f"Source folder not found: {source_dir}")
        print("Please specify the directory containing the downloaded PDFs as an argument.")
        return

    target_dir.mkdir(parents=True, exist_ok=True)
    pdf_files = list(source_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {source_dir}")
        return

    print(f"Found {len(pdf_files)} PDF files in {source_dir}. Importing into {target_dir}...")
    copied = 0
    imported_ids = set()

    for pdf in pdf_files:
        name = pdf.name
        dest = target_dir / name
        try:
            shutil.copy2(pdf, dest)
            copied += 1
            if name.startswith("paper_") and name.endswith(".pdf"):
                raw_id = name[len("paper_"):-len(".pdf")]
                if raw_id.isdigit():
                    imported_ids.add(int(raw_id))
        except Exception as e:
            print(f"Error copying {name}: {e}")

    print(f"Successfully copied {copied} papers into {target_dir}")

    if catalog_file.is_file() and imported_ids:
        try:
            with open(catalog_file, "r", encoding="utf-8") as f:
                catalog = json.load(f)
            updated = 0
            for item in catalog:
                if item["id"] in imported_ids:
                    if item.get("status") == "CATALOG_ONLY" or item.get("download_url") is None:
                        item["download_url"] = f"/api/papers/{item['id']}/source"
                        item["status"] = "LOCAL_PDF"
                        updated += 1
            with open(catalog_file, "w", encoding="utf-8") as f:
                json.dump(catalog, f, indent=2)
            print(f"Updated {updated} records in {catalog_file} to LOCAL_PDF status.")
        except Exception as e:
            print(f"Error updating catalog: {e}")

if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    target_papers = base_dir / "backend" / "temp" / "papers"
    catalog_path = base_dir / "backend" / "temp" / "mauryahub_catalog.json"

    if len(sys.argv) > 1:
        src = Path(sys.argv[1]).resolve()
    else:
        src = get_downloads_dir()

    import_papers(src, target_papers, catalog_path)
