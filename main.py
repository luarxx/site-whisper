import os
import time
import subprocess
import re
import psutil
from typing import List, Dict
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import shutil

app = FastAPI(title="Whisper VPS API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ──────────────────────────────────────────────────────────

# ── Configuração do Modelo ───────────────────────────────
MODEL_SIZE = "small"          # tiny | base | small | medium | large-v2 | large-v3
DEVICE = "cpu"                # cpu | cuda
COMPUTE_TYPE = "int8"         # int8 (CPU ARM/x86) | float16 (GPU) | float32
DEFAULT_LANGUAGE = "auto"
DEFAULT_TEMPERATURE = 0.0
DEFAULT_BEAM_SIZE = 5
DEFAULT_VAD_FILTER = True

print(f"Carregando o modelo Whisper ({MODEL_SIZE})...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Modelo carregado com sucesso!")

START_TIME = time.time()
# ──────────────────────────────────────────────────────────

# ── Health Check ──────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}


# ── Status & Monitoramento ────────────────────────────────
@app.get("/status")
def status():
    return {
        "online": True,
        "version": app.version,
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "latency_ms": 0.0,
        "resources": {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "gpu_percent": None,
            "gpu_name": None,
        },
        "current_config": {
            "model": MODEL_SIZE,
            "device": DEVICE,
            "compute_type": COMPUTE_TYPE,
            "language": DEFAULT_LANGUAGE,
            "temperature": DEFAULT_TEMPERATURE,
            "beam_size": DEFAULT_BEAM_SIZE,
            "vad_filter": DEFAULT_VAD_FILTER,
        },
    }


# ── Transcrição (OpenAI-compatible) ───────────────────────
@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    temperature: float = Form(0.0),
    beam_size: int = Form(5),
    vad_filter: bool = Form(True),
):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        segments_result, info = model.transcribe(
            temp_path,
            language=None if language == "auto" else language,
            beam_size=beam_size,
            temperature=temperature,
            vad_filter=vad_filter,
        )

        segments = []
        full_text = ""

        for seg in segments_result:
            segments.append({
                "id": seg.id,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text += seg.text

        return {
            "text": full_text.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration": round(info.duration, 2),
            "segments": segments,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Configuração ──────────────────────────────────────────
@app.get("/config")
def get_config():
    return {
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": DEFAULT_LANGUAGE,
        "temperature": DEFAULT_TEMPERATURE,
        "beam_size": DEFAULT_BEAM_SIZE,
        "vad_filter": DEFAULT_VAD_FILTER,
    }


@app.post("/config")
def set_config(patch: dict):
    global MODEL_SIZE, DEVICE, COMPUTE_TYPE
    global DEFAULT_LANGUAGE, DEFAULT_TEMPERATURE, DEFAULT_BEAM_SIZE, DEFAULT_VAD_FILTER
    global model

    new_model = patch.get("model", MODEL_SIZE)
    new_device = patch.get("device", DEVICE)
    new_compute_type = patch.get("compute_type", COMPUTE_TYPE)

    needs_reload = (
        new_model != MODEL_SIZE
        or new_device != DEVICE
        or new_compute_type != COMPUTE_TYPE
    )

    MODEL_SIZE = new_model
    DEVICE = new_device
    COMPUTE_TYPE = new_compute_type

    DEFAULT_LANGUAGE = patch.get("language", DEFAULT_LANGUAGE)
    DEFAULT_TEMPERATURE = patch.get("temperature", DEFAULT_TEMPERATURE)
    DEFAULT_BEAM_SIZE = patch.get("beam_size", DEFAULT_BEAM_SIZE)
    DEFAULT_VAD_FILTER = patch.get("vad_filter", DEFAULT_VAD_FILTER)

    if needs_reload:
        print(f"Reiniciando modelo Whisper: {MODEL_SIZE} / {DEVICE} / {COMPUTE_TYPE}")
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("Modelo reiniciado com sucesso!")

    return {
        "detail": "Configuração aplicada com sucesso.",
        "config": {
            "model": MODEL_SIZE,
            "device": DEVICE,
            "compute_type": COMPUTE_TYPE,
            "language": DEFAULT_LANGUAGE,
            "temperature": DEFAULT_TEMPERATURE,
            "beam_size": DEFAULT_BEAM_SIZE,
            "vad_filter": DEFAULT_VAD_FILTER,
        },
    }


# ── Logs (via journald) ───────────────────────────────────
SERVICE_NAME = "whisper"

_JOURNAL_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2}T[\d:+]+)\s+\S+\s+\S+\[\d+\]:\s*(.*)"
)

_LEVEL_KEYWORDS = {
    "ERROR": "ERROR",
    "WARNING": "WARN",
    "WARN": "WARN",
    "INFO": "INFO",
    "DEBUG": "DEBUG",
}


def _parse_journal_line(raw: str) -> Dict | None:
    m = _JOURNAL_RE.match(raw)
    if not m:
        return None

    timestamp, body = m.group(1), m.group(2)

    level = "INFO"
    for keyword, mapped in _LEVEL_KEYWORDS.items():
        if keyword in body.upper():
            level = mapped
            break

    return {"timestamp": timestamp, "level": level, "message": body}


@app.get("/logs")
def get_logs(limit: int = 200) -> Dict:
    """ Lê os últimos `limit` logs do systemd journal do serviço whisper. """
    try:
        result = subprocess.run(
            [
                "journalctl",
                "-u", SERVICE_NAME,
                "--no-pager",
                "-n", str(limit),
                "--output=short-iso",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        lines: List[Dict] = []
        for raw in result.stdout.strip().splitlines():
            parsed = _parse_journal_line(raw)
            if parsed:
                lines.append(parsed)

        return {"lines": lines, "total": len(lines)}

    except subprocess.TimeoutExpired:
        return {"lines": [], "total": 0}
    except Exception:
        return {"lines": [], "total": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
