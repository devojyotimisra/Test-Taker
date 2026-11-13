import json
import mimetypes
import os
import re
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.parser import parse_pdf_to_paper
from app.latex_compiler import compile_paper_to_pdf, generate_latex_source

app = FastAPI(title="Assessment API")

origins_raw = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if origins == ["*"] else origins,
    allow_origin_regex=r".*" if origins == ["*"] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

is_serverless = bool(
    os.getenv("VERCEL")
    or os.getenv("VERCEL_ENV")
    or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    or not os.access(".", os.W_OK)
)

BASE_DIR = Path(__file__).resolve().parent.parent

if is_serverless:
    UPLOAD_DIR = Path("/tmp/uploads")
    IMAGE_DIR = Path("/tmp/image")
else:
    UPLOAD_DIR = BASE_DIR / os.getenv("UPLOAD_DIR", "temp/uploads")
    IMAGE_DIR = BASE_DIR / os.getenv("IMAGE_DIR", "temp/image")

try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    UPLOAD_DIR = Path("/tmp/uploads")
    try:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

try:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    IMAGE_DIR = Path("/tmp/image")
    try:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Test Taker API",
        "version": "1.0.1"
    }


@app.post("/api/upload-pdf")
async def upload_pdf_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded PDF file is empty")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        paper = parse_pdf_to_paper(str(file_path), str(IMAGE_DIR))
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to parse the PDF document ({str(e)}). Please verify that the file is not corrupted or password-protected.",
        )

    if not paper or paper.total_questions == 0:
        raise HTTPException(
            status_code=422,
            detail="No questions could be extracted from this PDF. Please ensure it contains structured question numbers.",
        )

    return {"paper": paper.model_dump()}


@app.get("/temp/image/{filename}")
@app.get("/api/image/{filename}")
def serve_image(filename: str):
    file_path = IMAGE_DIR / Path(filename).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        file_path,
        media_type=media_type or "image/png",
        headers={"Cache-Control": "public, max-age=31536000"}
    )


DATA_PAPERS_DIR = BASE_DIR / "data" / "papers"
CATALOG_PATH = BASE_DIR / "data" / "catalog.json"


def get_catalog_map() -> dict:
    if CATALOG_PATH.is_file():
        try:
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)
                return {item.get("id"): item for item in items if isinstance(item, dict)}
        except Exception:
            return {}
    return {}


@app.get("/api/papers/{paper_id}/pdf")
def get_paper_pdf(paper_id: str):
    clean_id = paper_id.replace(".json", "")
    target = DATA_PAPERS_DIR / f"{clean_id}.json"
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Paper not found")

    with open(target, "r", encoding="utf-8") as f:
        paper_data = json.load(f)

    catalog_map = get_catalog_map()
    catalog_item = catalog_map.get(clean_id) or {
        "course_code": clean_id.split("_")[0].upper() if "_" in clean_id else "IITM",
        "exam_type": "Term Exam",
        "year": "2025",
        "term": "",
    }

    try:
        pdf_bytes = compile_paper_to_pdf(paper_data, catalog_item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LaTeX compilation failed: {str(e)}")

    out_name = f"{catalog_item.get('course_code', 'Paper')}_{catalog_item.get('year', '')}_{catalog_item.get('exam_type', 'Exam')}_Solutions.pdf"
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", out_name)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_name}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.get("/api/papers/{paper_id}/tex")
def get_paper_tex(paper_id: str):
    clean_id = paper_id.replace(".json", "")
    target = DATA_PAPERS_DIR / f"{clean_id}.json"
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Paper not found")

    with open(target, "r", encoding="utf-8") as f:
        paper_data = json.load(f)

    catalog_map = get_catalog_map()
    catalog_item = catalog_map.get(clean_id) or {}
    tex_code = generate_latex_source(paper_data, catalog_item)

    out_name = f"{clean_id}_Solutions.tex"
    return Response(
        content=tex_code,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
        },
    )


@app.post("/api/compile-latex-pdf")
async def compile_custom_latex(request: Request):
    payload = await request.json()
    paper_data = payload.get("paper")
    if not paper_data or not isinstance(paper_data, dict):
        raise HTTPException(status_code=400, detail="Missing or invalid paper data")
    catalog_item = payload.get("catalog_item") or {}

    try:
        pdf_bytes = compile_paper_to_pdf(paper_data, catalog_item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LaTeX compilation failed: {str(e)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="Examination_Paper_Solutions.pdf"',
        },
    )


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    app_module = "main:app"
    uvicorn.run(app_module, host=host, port=port, reload=True)
