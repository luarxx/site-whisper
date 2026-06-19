import os
import json
import time
import subprocess
import re
import glob as glob_module
import uuid
import httpx
import psutil
from typing import List, Dict, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
CONFIG_FILE = "whisper_config.json"
STARTUP_MARKER = ".whisper_startup"
CRASH_WINDOW_SECONDS = 120
SAFE_DEFAULTS = {"model": "small", "device": "cpu", "compute_type": "int8"}

DEFAULTS = {
    "model": "small",
    "device": "cpu",
    "compute_type": "int8",
    "language": "auto",
    "temperature": 0.0,
    "beam_size": 5,
    "vad_filter": True,
}


def _load_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                return {**DEFAULTS, **json.load(f)}
        except (json.JSONDecodeError, OSError):
            print(f"[Config] Arquivo corrompido — usando padrões")
    return dict(DEFAULTS)


def _save_config(cfg: dict):
    existing = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                existing = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    existing.update(cfg)
    os.makedirs(os.path.dirname(CONFIG_FILE) or ".", exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(existing, f, indent=2)


def _cleanup_temp_files():
    for f in glob_module.glob("temp_*"):
        try:
            os.remove(f)
            print(f"[Cleanup] Arquivo temporário removido: {f}")
        except OSError:
            pass


def _check_crash_and_recover() -> bool:
    if not os.path.exists(STARTUP_MARKER):
        return False
    try:
        age = time.time() - os.path.getmtime(STARTUP_MARKER)
    except OSError:
        return False
    if age < CRASH_WINDOW_SECONDS:
        print(f"[Crash] Detectado crash recente ({age:.0f}s atrás). Forçando safe defaults.")
        return True
    print(f"[Startup] Marcador antigo ignorado ({age:.0f}s atrás).")
    return False


config = _load_config()

crashed = _check_crash_and_recover()
if crashed:
    config.update(SAFE_DEFAULTS)
    _save_config(config)
    print("[Crash] Configuração redefinida para safe defaults e salva em disco.")

MODEL_SIZE = config["model"]
DEVICE = config["device"]
COMPUTE_TYPE = config["compute_type"]
DEFAULT_LANGUAGE = config["language"]
DEFAULT_TEMPERATURE = config["temperature"]
DEFAULT_BEAM_SIZE = config["beam_size"]
DEFAULT_VAD_FILTER = config["vad_filter"]

if DEVICE == "cpu" and COMPUTE_TYPE in ("float16", ):
    print(f"  [Config] compute_type={COMPUTE_TYPE} não suportado em CPU. Usando int8.")
    COMPUTE_TYPE = "int8"

print(f"[Config] Modelo: {MODEL_SIZE} / {DEVICE} / {COMPUTE_TYPE}")
print(f"Carregando o modelo Whisper ({MODEL_SIZE})...")

_cleanup_temp_files()

with open(STARTUP_MARKER, "w") as f:
    f.write(str(time.time()))

try:
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    print("Modelo carregado com sucesso!")
    if os.path.exists(STARTUP_MARKER):
        os.remove(STARTUP_MARKER)
except Exception as e:
    print(f"Falha ao carregar modelo ({e}). Usando defaults: small / cpu / int8")
    MODEL_SIZE, DEVICE, COMPUTE_TYPE = "small", "cpu", "int8"
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    _save_config({
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": DEFAULT_LANGUAGE,
        "temperature": DEFAULT_TEMPERATURE,
        "beam_size": DEFAULT_BEAM_SIZE,
        "vad_filter": DEFAULT_VAD_FILTER,
    })
    if os.path.exists(STARTUP_MARKER):
        os.remove(STARTUP_MARKER)
    print("Modelo small carregado como fallback.")

START_TIME = time.time()
# ──────────────────────────────────────────────────────────

# ── Configuração Evolution API ────────────────────────────
EVOLUTION_DEFAULTS = {
    "evolution_api_url": "http://localhost:8080",
    "evolution_api_key": "",
    "whatsapp_webhook_url": "",
}

EVOLUTION_INSTANCE_NAME = "whisper-bot"

evolution_config = {**EVOLUTION_DEFAULTS, **config.get("evolution", {})}

EVOLUTION_API_URL = evolution_config["evolution_api_url"].rstrip("/")
EVOLUTION_API_KEY = evolution_config["evolution_api_key"]
WHATSAPP_WEBHOOK_URL = evolution_config["whatsapp_webhook_url"]


def _save_evolution_config():
    full = _load_config()
    full["evolution"] = {
        "evolution_api_url": EVOLUTION_API_URL,
        "evolution_api_key": EVOLUTION_API_KEY,
        "whatsapp_webhook_url": WHATSAPP_WEBHOOK_URL,
    }
    _save_config(full)


def _evolution_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if EVOLUTION_API_KEY:
        headers["apikey"] = EVOLUTION_API_KEY
    return headers


async def _evolution_proxy(method: str, path: str, **kwargs) -> dict:
    url = f"{EVOLUTION_API_URL}{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, url, headers=_evolution_headers(), **kwargs)
        if resp.status_code >= 400:
            detail = "Erro na Evolution API"
            try:
                body = resp.json()
                detail = body.get("response", {}).get("message", body.get("message", detail))
            except Exception:
                detail = resp.text[:200]
            raise HTTPException(status_code=resp.status_code, detail=detail)
        return resp.json()
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
    safe_name = (file.filename or "audio").replace("\\", "/")
    safe_name = os.path.basename(safe_name)
    temp_path = f"temp_{uuid.uuid4().hex[:8]}_{safe_name}"
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

    DEFAULT_LANGUAGE = patch.get("language", DEFAULT_LANGUAGE)
    DEFAULT_TEMPERATURE = patch.get("temperature", DEFAULT_TEMPERATURE)
    DEFAULT_BEAM_SIZE = patch.get("beam_size", DEFAULT_BEAM_SIZE)
    DEFAULT_VAD_FILTER = patch.get("vad_filter", DEFAULT_VAD_FILTER)

    if new_device == "cpu" and new_compute_type == "float16":
        raise HTTPException(status_code=400, detail="compute_type 'float16' não é suportado em CPU. Use 'int8', 'int8_float16' ou 'float32'.")

    if needs_reload:
        old_model, old_device, old_compute = MODEL_SIZE, DEVICE, COMPUTE_TYPE
        print(f"Reiniciando modelo Whisper: {new_model} / {new_device} / {new_compute_type}")
        import gc
        try:
            del model
            gc.collect()
            model = WhisperModel(new_model, device=new_device, compute_type=new_compute_type)
        except Exception as e:
            err_msg = str(e)
            print(f"Falha ao recarregar modelo: {err_msg}")
            MODEL_SIZE, DEVICE, COMPUTE_TYPE = old_model, old_device, old_compute
            model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
            raise HTTPException(status_code=400, detail=err_msg)

    MODEL_SIZE = new_model
    DEVICE = new_device
    COMPUTE_TYPE = new_compute_type

    _save_config({
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": DEFAULT_LANGUAGE,
        "temperature": DEFAULT_TEMPERATURE,
        "beam_size": DEFAULT_BEAM_SIZE,
        "vad_filter": DEFAULT_VAD_FILTER,
    })

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


# ── WhatsApp / Evolution API ─────────────────────────────
def _extract_whatsapp_state(data) -> str:
    """Extrai o estado da conexao da Evolution API, lidando com varios formatos de resposta."""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        return data.get("state") or data.get("connectionState") or data.get("status") or "connecting"
    return "connecting"


@app.post("/whatsapp/instance")
async def whatsapp_create_instance(patch: dict):
    global EVOLUTION_API_URL, EVOLUTION_API_KEY, WHATSAPP_WEBHOOK_URL

    if "evolutionApiUrl" in patch:
        EVOLUTION_API_URL = patch["evolutionApiUrl"].rstrip("/")
    if "apiKey" in patch:
        EVOLUTION_API_KEY = patch["apiKey"]

    _save_evolution_config()

    if not EVOLUTION_API_KEY:
        raise HTTPException(status_code=400, detail="API Key da Evolution é obrigatória.")

    try:
        instances = await _evolution_proxy("GET", "/instance/fetchInstances")
    except HTTPException:
        instances = []

    exists = any(
        inst.get("name") == EVOLUTION_INSTANCE_NAME
        for inst in (instances if isinstance(instances, list) else [])
    )

    if not exists:
        webhook_data = {}
        if WHATSAPP_WEBHOOK_URL:
            webhook_data["webhook"] = {
                "url": WHATSAPP_WEBHOOK_URL,
                "events": ["messages.upsert"],
            }

        await _evolution_proxy(
            "POST",
            "/instance/create",
            json={
                "instanceName": EVOLUTION_INSTANCE_NAME,
                "integration": "WHATSAPP-BAILEYS",
                "token": EVOLUTION_API_KEY,
                **webhook_data,
                "qrcode": True,
            },
        )

    connect_data = await _evolution_proxy(
        "GET", f"/instance/connect/{EVOLUTION_INSTANCE_NAME}"
    )
    print(f"[WhatsApp] connect response keys={list(connect_data.keys()) if isinstance(connect_data, dict) else type(connect_data).__name__!r}")

    if isinstance(connect_data, str):
        qrcode = connect_data if len(connect_data) > 20 else None
    elif isinstance(connect_data, dict):
        qrcode = connect_data.get("base64") or connect_data.get("qrcode") or connect_data.get("code") or None
    else:
        qrcode = None

    state = "connecting"
    if qrcode is None:
        state = "connected"

    return {"qrcode": qrcode, "state": state, "instanceName": EVOLUTION_INSTANCE_NAME}


@app.get("/whatsapp/instance")
async def whatsapp_status():
    try:
        data = await _evolution_proxy(
            "GET", f"/instance/connectionState/{EVOLUTION_INSTANCE_NAME}"
        )
        raw = _extract_whatsapp_state(data)
        print(f"[WhatsApp] connectionState raw={raw!r} data={data!r}")
        state_map = {
            "open": "connected",
            "connecting": "connecting",
            "close": "idle",
            "disconnected": "idle",
            "qrRead": "connecting",
            "init": "connecting",
            "authed": "connecting",
            "refused": "connecting",
            "timeout": "connecting",
            "conflict": "connecting",
        }
        return {
            "state": state_map.get(raw, "connecting"),
            "instanceName": EVOLUTION_INSTANCE_NAME,
        }
    except HTTPException as e:
        print(f"[WhatsApp] HTTPException ao obter status: {e.detail}")
        return {"state": "idle", "instanceName": EVOLUTION_INSTANCE_NAME}
    except Exception as e:
        print(f"[WhatsApp] Erro inesperado ao obter status: {type(e).__name__}: {e}")
        return {"state": "idle", "instanceName": EVOLUTION_INSTANCE_NAME}


@app.delete("/whatsapp/instance")
async def whatsapp_disconnect():
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/logout/{EVOLUTION_INSTANCE_NAME}"
        )
    except HTTPException:
        pass
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/delete/{EVOLUTION_INSTANCE_NAME}"
        )
    except HTTPException:
        pass
    return {"detail": "WhatsApp desconectado com sucesso."}


@app.put("/whatsapp/instance/pause")
async def whatsapp_pause():
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/logout/{EVOLUTION_INSTANCE_NAME}"
        )
        return {"state": "paused", "instanceName": EVOLUTION_INSTANCE_NAME}
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code, detail="Falha ao pausar WhatsApp.")


@app.put("/whatsapp/instance/resume")
async def whatsapp_resume():
    connect_data = await _evolution_proxy(
        "GET", f"/instance/connect/{EVOLUTION_INSTANCE_NAME}"
    )
    qrcode = connect_data.get("base64") or connect_data.get("qrcode") or None
    state = "connecting"
    if qrcode is None:
        state = "connected"
    return {"qrcode": qrcode, "state": state, "instanceName": EVOLUTION_INSTANCE_NAME}


# ── Webhook da Evolution API ────────────────────────────
@app.post("/webhook/evolution")
async def evolution_webhook(request: Request):
    body = await request.json()
    print(f"[Webhook] Evento recebido: {json.dumps(body, indent=2)[:500]}")

    event = body.get("event", "")
    data = body.get("data", {})

    if event != "messages.upsert":
        return {"status": "ignored", "event": event}

    message = data.get("message", {})
    msg_type = message.get("messageType", message.get("type", ""))

    if msg_type not in ("audio", "ptt"):
        return {"status": "ignored", "type": msg_type}

    key = message.get("key", {})
    remote_jid = key.get("remoteJid", "")
    from_me = key.get("fromMe", False)

    if from_me:
        return {"status": "ignored", "reason": "own_message"}

    audio_url = None
    audio_message = message.get("audioMessage") or message.get("audio", {})
    if audio_message:
        audio_url = audio_message.get("url") or audio_message.get("mediaUrl")

    if not audio_url:
        return {"status": "ignored", "reason": "no_audio_url"}

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            headers = _evolution_headers()
            audio_resp = await client.get(audio_url, headers=headers)
            audio_resp.raise_for_status()

        audio_bytes = audio_resp.content
        temp_path = f"temp_whatsapp_{int(time.time())}.ogg"
        with open(temp_path, "wb") as f:
            f.write(audio_bytes)

        try:
            segments_result, info = model.transcribe(
                temp_path,
                language=None if DEFAULT_LANGUAGE == "auto" else DEFAULT_LANGUAGE,
                beam_size=DEFAULT_BEAM_SIZE,
                temperature=DEFAULT_TEMPERATURE,
                vad_filter=DEFAULT_VAD_FILTER,
            )
            full_text = "".join(seg.text for seg in segments_result).strip()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        if not full_text:
            full_text = "[Não foi possível transcrever o áudio]"

        await _evolution_proxy(
            "POST",
            f"/message/sendText/{EVOLUTION_INSTANCE_NAME}",
            json={
                "number": remote_jid,
                "text": f"🗣️ Transcrição:\n\n{full_text}",
            },
        )

        print(f"[Webhook] Transcrição enviada para {remote_jid}")
        return {"status": "success", "text": full_text}

    except Exception as e:
        print(f"[Webhook] Erro ao processar áudio: {e}")
        try:
            await _evolution_proxy(
                "POST",
                f"/message/sendText/{EVOLUTION_INSTANCE_NAME}",
                json={
                    "number": remote_jid,
                    "text": "❌ Erro ao transcrever o áudio. Tente novamente.",
                },
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


# ── Frontend Estático ─────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
