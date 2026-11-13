import mimetypes
import os
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.parser import parse_pdf_to_paper

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


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    app_module = "main:app"
    uvicorn.run(app_module, host=host, port=port, reload=True)
