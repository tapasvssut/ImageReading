import os

# Disable paddlex/paddlepaddle's MKLDNN (oneDNN) default on Intel CPUs.
# paddlepaddle 3.x has a PIR executor bug with oneDNN on Windows:
#   NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support
#   [pir::ArrayAttribute<pir::DoubleAttribute>] (onednn_instruction.cc:118)
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_engine = PaddleOCR(use_textline_orientation=True, lang="en")


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    suffix = os.path.splitext(file.filename)[1].lower() or ".jpg"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # predict() returns a list of result objects (one per image)
        results = list(ocr_engine.predict(tmp_path))

        if not results:
            return {"text": "", "readProbability": 0, "status": "No text found"}

        res = results[0]
        rec_texts: list = res.get("rec_texts") or []
        rec_scores: list = res.get("rec_scores") or []

        if not rec_texts:
            return {"text": "", "readProbability": 0, "status": "No text found"}

        lines: list[str] = [str(t) for t in rec_texts]
        confidences: list[float] = [float(s) for s in rec_scores]

        full_text = "\n".join(lines)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        read_probability = round(avg_confidence * 100, 2)

        if read_probability >= 90:
            status = "Crystal Clear"
        elif read_probability >= 70:
            status = "Readable"
        else:
            status = "Low Quality"

        return {
            "text": full_text,
            "readProbability": read_probability,
            "status": status,
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
