import mimetypes
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
try:
    from backend.models import AnswerSubmission, Paper
    from backend.parser import parse_pdf_to_paper
    from backend.scorer import score_question
except ModuleNotFoundError:
    from models import AnswerSubmission, Paper
    from parser import parse_pdf_to_paper
    from scorer import score_question

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

is_vercel = os.getenv("VERCEL") == "1"
BASE_DIR = Path(__file__).resolve().parent.parent

if is_vercel:
    UPLOAD_DIR = Path("/tmp/uploads")
    IMAGE_DIR = Path("/tmp/image")
else:
    UPLOAD_DIR = BASE_DIR / os.getenv("UPLOAD_DIR", "temp/uploads")
    IMAGE_DIR = BASE_DIR / os.getenv("IMAGE_DIR", "temp/image")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

current_paper: Optional[Paper] = None


def get_active_paper() -> Optional[Paper]:
    global current_paper
    if current_paper is not None:
        return current_paper
    cache_path = UPLOAD_DIR / "current_paper.json"
    if cache_path.is_file():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                current_paper = Paper.model_validate_json(f.read())
        except Exception:
            pass
    return current_paper


@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Test Taker API",
        "version": "1.0.1"
    }


@app.get("/api/paper")
def get_paper_info():
    paper = get_active_paper()
    if paper is None:
        return {"paper": None}
    return {
        "paper": {
            "title": paper.title,
            "filename": paper.filename,
            "total_questions": paper.total_questions,
            "total_marks": paper.total_marks,
        }
    }


@app.get("/api/questions")
def get_questions_list():
    paper = get_active_paper()
    if paper is None:
        return []
    result = []
    for q in paper.questions:
        item = q.model_dump()
        result.append(item)
    return result


@app.post("/api/check-question")
def check_single_question(submission: AnswerSubmission):
    paper = get_active_paper()
    if paper is None:
        raise HTTPException(status_code=400, detail="No test paper loaded")
    target_q = next((q for q in paper.questions if q.id == submission.question_id), None)
    if not target_q:
        raise HTTPException(status_code=404, detail="Question not found")
    result = score_question(target_q, submission.answer)
    return result


@app.post("/api/upload-pdf")
async def upload_pdf_file(file: UploadFile = File(...)):
    global current_paper
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / file.filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    paper = parse_pdf_to_paper(str(file_path), str(IMAGE_DIR))
    current_paper = paper

    cache_path = UPLOAD_DIR / "current_paper.json"
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(paper.model_dump_json())
    except Exception:
        pass

    return {
        "paper": {
            "title": paper.title,
            "filename": paper.filename,
            "total_questions": paper.total_questions,
            "total_marks": paper.total_marks,
        }
    }


@app.post("/api/reset")
def reset_session():
    global current_paper
    current_paper = None
    cache_path = UPLOAD_DIR / "current_paper.json"
    if cache_path.is_file():
        try:
            cache_path.unlink(missing_ok=True)
        except Exception:
            pass
    return {"status": "ok"}


@app.get("/temp/image/{filename}")
def serve_image(filename: str):
    file_path = IMAGE_DIR / Path(filename).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "image/png")


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found", "path": request.url.path})
        if FRONTEND_DIST.is_dir() and (FRONTEND_DIST / "index.html").is_file():
            return FileResponse(FRONTEND_DIST / "index.html")
        return HTMLResponse(
            status_code=404,
            content="""<!doctype html><html><head><meta charset="utf-8"><title>404 - Not Found</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#f8fafc;flex-direction:column}h1{font-size:4rem;margin:0;color:#8b5cf6}p{color:#94a3b8}a{margin-top:1rem;color:#8b5cf6;text-decoration:none;border:1px solid #8b5cf6;padding:8px 16px;border-radius:8px}</style></head><body><h1>404</h1><p>Endpoint or page not found</p><a href="/">Return to Home</a></body></html>"""
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    app_module = "backend.main:app" if Path("backend").is_dir() else "main:app"
    uvicorn.run(app_module, host=host, port=port, reload=True)
