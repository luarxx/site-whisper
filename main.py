import os
import json
import time
import subprocess
import re
import glob as glob_module
import uuid
import threading
import httpx
import psutil
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, Body, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import APIKeyHeader
from faster_whisper import WhisperModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import shutil

app = FastAPI(title="Whisper VPS API", version="1.0.0")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("shutdown")
async def shutdown_event():
    print("[Shutdown] Aguardando operações em andamento...")
    import asyncio
    await asyncio.sleep(3)
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
    print("[Shutdown] Finalizado.")

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ──────────────────────────────────────────────────────────

# ── Autenticação ─────────────────────────────────────────
WHISPER_API_KEY = os.getenv("WHISPER_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _verify_api_key(key: Optional[str] = Security(_api_key_header)):
    if not WHISPER_API_KEY:
        return
    if key != WHISPER_API_KEY:
        raise HTTPException(status_code=403, detail="API key inválida.")

# ──────────────────────────────────────────────────────────

# ── Model Concurrency Control ────────────────────────────
_model_lock = threading.Lock()
_model_ref_count = 0
_model_ref_cv = threading.Condition(_model_lock)


class ModelHandle:
    """Thread-safe wrapper for the WhisperModel with read-write lock semantics.

    Readers (transcription) call acquire()/release(). The writer (config reload)
    calls reload() which drains all active readers before swapping the model.
    """

    def __init__(self):
        self._model: Optional[WhisperModel] = None
        self._reload_lock = threading.Lock()

    @property
    def model(self) -> Optional[WhisperModel]:
        return self._model

    def acquire(self) -> WhisperModel:
        global _model_ref_count
        with _model_ref_cv:
            _model_ref_count += 1
        return self._model

    def release(self):
        global _model_ref_count
        with _model_ref_cv:
            _model_ref_count -= 1
            if _model_ref_count == 0:
                _model_ref_cv.notify_all()

    def _drain_readers(self):
        with _model_ref_cv:
            while _model_ref_count > 0:
                _model_ref_cv.wait(timeout=1.0)

    def reload(self, model_size: str, device: str, compute_type: str) -> WhisperModel:
        self._drain_readers()
        with self._reload_lock:
            old = self._model
            try:
                import gc
                del old
                gc.collect()
                new_model = WhisperModel(model_size, device=device, compute_type=compute_type)
                self._model = new_model
                return new_model
            except Exception:
                self._model = old
                raise

    def set_initial(self, model: WhisperModel):
        self._model = model


model_handle = ModelHandle()

_audio_counter = 0
_audio_counter_lock = threading.Lock()


def _next_audio_number() -> int:
    global _audio_counter
    with _audio_counter_lock:
        _audio_counter += 1
        return _audio_counter


_webhook_error_count = 0
_webhook_error_lock = threading.Lock()
_MAX_ERROR_REPLIES = 3

_DEDUP_TTL_SECONDS = 3600
_dedup_lock = threading.Lock()
_in_flight_messages: Dict[str, float] = {}
_completed_messages: Dict[str, float] = {}
SERVER_START_TIME = time.time()

DEDUP_PERSIST_FILE = "webhook_dedup.json"


def _dedup_persist_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DEDUP_PERSIST_FILE)


def _dedup_load_persisted():
    path = _dedup_persist_path()
    if not os.path.exists(path):
        return
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return
        now = time.time()
        with _dedup_lock:
            for k, v in data.items():
                try:
                    ts = float(v)
                except (TypeError, ValueError):
                    continue
                if now - ts < _DEDUP_TTL_SECONDS:
                    _completed_messages[k] = ts
        print(f"[Dedup] Cache carregado: {len(_completed_messages)} mensagens")
    except Exception as e:
        print(f"[Dedup] Falha ao carregar cache: {e}")


def _dedup_save_persisted():
    path = _dedup_persist_path()
    try:
        with _dedup_lock:
            snapshot = dict(_completed_messages)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(snapshot, f)
        os.replace(tmp, path)
    except Exception as e:
        print(f"[Dedup] Falha ao salvar cache: {e}")


_dedup_load_persisted()


def _dedup_cleanup_expired():
    now = time.time()
    for store in (_in_flight_messages, _completed_messages):
        expired = [k for k, t in store.items() if now - t > _DEDUP_TTL_SECONDS]
        for k in expired:
            del store[k]


def _dedup_try_start(message_id: str) -> tuple[bool, str]:
    if not message_id:
        return True, ""
    with _dedup_lock:
        _dedup_cleanup_expired()
        if message_id in _completed_messages:
            return False, "already_completed"
        if message_id in _in_flight_messages:
            return False, "already_in_flight"
        _in_flight_messages[message_id] = time.time()
        return True, ""


def _dedup_complete(message_id: str):
    if not message_id:
        return
    with _dedup_lock:
        _in_flight_messages.pop(message_id, None)
        _completed_messages[message_id] = time.time()
    _dedup_save_persisted()


def _dedup_fail(message_id: str):
    if not message_id:
        return
    with _dedup_lock:
        _in_flight_messages.pop(message_id, None)
# ──────────────────────────────────────────────────────────

# ── Configuração do Modelo ───────────────────────────────
CONFIG_FILE = "whisper_config.json"
LAST_KNOWN_GOOD_CONFIG = "whisper_last_good.json"
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


def _save_config(cfg: dict) -> None:
    os.makedirs(os.path.dirname(CONFIG_FILE) or ".", exist_ok=True)
    tmp_path = CONFIG_FILE + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(cfg, f, indent=2)
    os.replace(tmp_path, CONFIG_FILE)


def _save_last_known_good(cfg: dict) -> None:
    snapshot = {k: cfg.get(k, DEFAULTS[k]) for k in DEFAULTS}
    os.makedirs(os.path.dirname(LAST_KNOWN_GOOD_CONFIG) or ".", exist_ok=True)
    with open(LAST_KNOWN_GOOD_CONFIG, "w") as f:
        json.dump(snapshot, f, indent=2)


def _load_last_known_good() -> Optional[dict]:
    if not os.path.exists(LAST_KNOWN_GOOD_CONFIG):
        return None
    try:
        with open(LAST_KNOWN_GOOD_CONFIG) as f:
            data = json.load(f)
        if data.get("model") in ("", None):
            return None
        return {**DEFAULTS, **data}
    except (json.JSONDecodeError, OSError):
        return None


def _cleanup_temp_files() -> None:
    for f in glob_module.glob("temp_*"):
        try:
            os.remove(f)
            print(f"[Cleanup] Arquivo temporário removido: {f}")
        except OSError:
            pass


def _check_crash_and_recover(config: dict) -> bool:
    if not os.path.exists(STARTUP_MARKER):
        return False
    try:
        age = time.time() - os.path.getmtime(STARTUP_MARKER)
    except OSError:
        return False
    if age >= CRASH_WINDOW_SECONDS:
        print(f"[Startup] Marcador antigo ignorado ({age:.0f}s atrás).")
        return False

    print(f"[Crash] Detectado crash recente ({age:.0f}s atrás).")
    last_good = _load_last_known_good()
    if last_good and last_good.get("model") != SAFE_DEFAULTS["model"]:
        config.update(last_good)
        _save_config(config)
        print("[Crash] Restaurando último modelo estável known-good.")
    else:
        config.update(SAFE_DEFAULTS)
        _save_config(config)
        print("[Crash] Sem last-good, forçando safe defaults.")
    return True


config = _load_config()

_check_crash_and_recover(config)

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
    _loaded_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    model_handle.set_initial(_loaded_model)
    print("Modelo carregado com sucesso!")
    _save_last_known_good({
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
except Exception as e:
    print(f"Falha ao carregar modelo ({e}). Usando defaults: small / cpu / int8")
    MODEL_SIZE, DEVICE, COMPUTE_TYPE = "small", "cpu", "int8"
    _loaded_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    model_handle.set_initial(_loaded_model)
    _save_config({
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": DEFAULT_LANGUAGE,
        "temperature": DEFAULT_TEMPERATURE,
        "beam_size": DEFAULT_BEAM_SIZE,
        "vad_filter": DEFAULT_VAD_FILTER,
    })
    _save_last_known_good({
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

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

START_TIME = time.time()
# ──────────────────────────────────────────────────────────

# ── Configuração Evolution API ────────────────────────────
EVOLUTION_DEFAULTS = {
    "evolution_api_url": "http://localhost:8080",
    "evolution_api_key": "",
    "whatsapp_webhook_url": "",
    "whatsapp_self_chat_jid": "",
}

EVOLUTION_INSTANCE_NAME = "whisper-bot"

evolution_config = {**EVOLUTION_DEFAULTS, **config.get("evolution", {})}

EVOLUTION_API_URL = evolution_config["evolution_api_url"].rstrip("/")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "") or evolution_config.get("evolution_api_key", "")
WHATSAPP_WEBHOOK_URL = evolution_config["whatsapp_webhook_url"]
SELF_CHAT_JID = (evolution_config.get("whatsapp_self_chat_jid") or "").strip() or None


def _save_evolution_config():
    full = _load_config()
    evo = {
        "evolution_api_url": EVOLUTION_API_URL,
        "whatsapp_webhook_url": WHATSAPP_WEBHOOK_URL,
    }
    if EVOLUTION_API_KEY:
        evo["evolution_api_key"] = EVOLUTION_API_KEY
    if SELF_CHAT_JID:
        evo["whatsapp_self_chat_jid"] = SELF_CHAT_JID
    full["evolution"] = evo
    _save_config(full)


def _set_self_chat_jid(jid: str):
    global SELF_CHAT_JID
    if not jid or jid == SELF_CHAT_JID:
        return
    SELF_CHAT_JID = jid
    _save_evolution_config()
    print(f"[WhatsApp] Self-chat JID fixado: {jid}")


def _clear_self_chat_jid():
    global SELF_CHAT_JID
    if SELF_CHAT_JID is None:
        return
    SELF_CHAT_JID = None
    _save_evolution_config()
    print("[WhatsApp] Self-chat JID limpo (instancia recriada).")


def _evolution_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if EVOLUTION_API_KEY:
        headers["apikey"] = EVOLUTION_API_KEY
    return headers


_http_client: Optional[httpx.AsyncClient] = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=30,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
    return _http_client


async def _evolution_proxy(method: str, path: str, **kwargs) -> dict:
    url = f"{EVOLUTION_API_URL}{path}"
    client = _get_http_client()
    try:
        resp = await client.request(method, url, headers=_evolution_headers(), **kwargs)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível conectar à Evolution API em {EVOLUTION_API_URL}. Verifique se o serviço está rodando.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=f"Timeout ao conectar à Evolution API em {EVOLUTION_API_URL}.",
        )
    if resp.status_code >= 400:
        detail = "Erro na Evolution API"
        try:
            body = resp.json()
            detail = body.get("response", {}).get("message", body.get("message", detail))
        except Exception:
            detail = resp.text[:200]
        if resp.status_code in (401, 403):
            detail = f"API Key inválida ou sem permissão. Verifique a EVOLUTION_API_KEY configurada no servidor."
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()
# ──────────────────────────────────────────────────────────

# ── Health Check ──────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}


# ── Status & Monitoramento ────────────────────────────────
@app.get("/status")
def status(_=Depends(_verify_api_key)):
    return {
        "online": True,
        "version": app.version,
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "latency_ms": 0.0,
        "resources": {
            "cpu_percent": psutil.cpu_percent(interval=None),
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
@limiter.limit("5/minute")
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    temperature: float = Form(0.0),
    beam_size: int = Form(5),
    vad_filter: bool = Form(True),
    _=Depends(_verify_api_key),
):
    safe_name = (file.filename or "audio").replace("\\", "/")
    safe_name = os.path.basename(safe_name)
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Arquivo muito grande ({len(contents)} bytes). Limite: {MAX_UPLOAD_BYTES} bytes.")
    temp_path = f"temp_{uuid.uuid4().hex[:8]}_{safe_name}"
    with open(temp_path, "wb") as buffer:
        buffer.write(contents)

    try:
        m = model_handle.acquire()
        try:
            segments_result, info = m.transcribe(
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
        finally:
            model_handle.release()

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao processar transcrição.")

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Configuração ──────────────────────────────────────────
@app.get("/config")
def get_config(_=Depends(_verify_api_key)):
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
def set_config(patch: dict, _=Depends(_verify_api_key)):
    global MODEL_SIZE, DEVICE, COMPUTE_TYPE
    global DEFAULT_LANGUAGE, DEFAULT_TEMPERATURE, DEFAULT_BEAM_SIZE, DEFAULT_VAD_FILTER

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
        try:
            model_handle.reload(new_model, new_device, new_compute_type)
        except Exception as e:
            err_msg = str(e)
            print(f"Falha ao recarregar modelo: {err_msg}")
            MODEL_SIZE, DEVICE, COMPUTE_TYPE = old_model, old_device, old_compute
            model_handle.reload(MODEL_SIZE, DEVICE, COMPUTE_TYPE)
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

    _save_last_known_good({
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


def _parse_journal_json(raw: str) -> Dict | None:
    try:
        entry = json.loads(raw)
        priority = entry.get("PRIORITY", 6)
        level_map = {0: "EMERG", 1: "ALERT", 2: "CRIT", 3: "ERROR", 4: "WARN", 5: "NOTICE", 6: "INFO", 7: "DEBUG"}
        level = level_map.get(priority, "INFO")
        timestamp_us = entry.get("__REALTIME_TIMESTAMP", "")
        if timestamp_us:
            try:
                ts_sec = int(timestamp_us) / 1_000_000
                from datetime import datetime, timezone
                dt = datetime.fromtimestamp(ts_sec, tz=timezone.utc)
                timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S%z")
            except (ValueError, OSError):
                timestamp = str(timestamp_us)
        else:
            timestamp = ""
        message = entry.get("MESSAGE", "")
        return {"timestamp": timestamp, "level": level, "message": message}
    except (json.JSONDecodeError, TypeError):
        return None


@app.get("/logs")
def get_logs(limit: int = 200, _=Depends(_verify_api_key)) -> Dict:
    """ Lê os últimos `limit` logs do systemd journal do serviço whisper. """
    try:
        result = subprocess.run(
            [
                "journalctl",
                "-u", SERVICE_NAME,
                "--no-pager",
                "-n", str(limit),
                "--output=json",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        lines: List[Dict] = []
        for raw in result.stdout.strip().splitlines():
            parsed = _parse_journal_json(raw)
            if parsed:
                lines.append(parsed)

        return {"lines": lines, "total": len(lines)}

    except subprocess.TimeoutExpired:
        return {"lines": [], "total": 0}
    except Exception:
        return {"lines": [], "total": 0}


# ── WhatsApp / Evolution API ─────────────────────────────
def _extract_whatsapp_state(data) -> str:
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        val = data.get("state") or data.get("connectionState")
        if isinstance(val, str):
            return val
        inst = data.get("instance")
        if isinstance(inst, dict):
            val2 = inst.get("state") or inst.get("connectionState")
            if isinstance(val2, str):
                return val2
    return "close"


@app.post("/whatsapp/instance")
async def whatsapp_create_instance(patch: dict = Body(default={}), _=Depends(_verify_api_key)):
    global EVOLUTION_API_URL, EVOLUTION_API_KEY, WHATSAPP_WEBHOOK_URL

    if "evolutionApiUrl" in patch:
        EVOLUTION_API_URL = patch["evolutionApiUrl"].rstrip("/")
    if "apiKey" in patch:
        EVOLUTION_API_KEY = patch["apiKey"]

    WHATSAPP_WEBHOOK_URL = "http://localhost:8000/webhook/evolution"
    _save_evolution_config()

    if not EVOLUTION_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="API Key da Evolution não configurada. Defina a variável de ambiente EVOLUTION_API_KEY no servidor ou configure no whisper_config.json.",
        )

    try:
        instances = await _evolution_proxy("GET", "/instance/fetchInstances")
    except HTTPException:
        instances = []

    exists = any(
        inst.get("name") == EVOLUTION_INSTANCE_NAME
        for inst in (instances if isinstance(instances, list) else [])
    )

    if exists:
        inst = next(
            (i for i in instances if isinstance(i, dict) and i.get("name") == EVOLUTION_INSTANCE_NAME),
            None,
        )
        dead = False
        if inst:
            code = inst.get("disconnectionReasonCode")
            obj = inst.get("disconnectionObject", "")
            if code == 401 or (isinstance(obj, str) and "device_removed" in obj):
                dead = True
        if dead:
            print("[WhatsApp] Sessao morta detectada, removendo instancia...")
            try:
                await _evolution_proxy("DELETE", f"/instance/logout/{EVOLUTION_INSTANCE_NAME}")
            except Exception:
                pass
            try:
                await _evolution_proxy("DELETE", f"/instance/delete/{EVOLUTION_INSTANCE_NAME}")
                print("[WhatsApp] Instancia removida com sucesso.")
            except Exception as e:
                print(f"[WhatsApp] Falha ao deletar instancia: {e}")
            _clear_self_chat_jid()
            exists = False

    if not exists:
        await _evolution_proxy(
            "POST",
            "/instance/create",
            json={
                "instanceName": EVOLUTION_INSTANCE_NAME,
                "integration": "WHATSAPP-BAILEYS",
                "token": EVOLUTION_API_KEY,
                "webhook": {
                    "url": WHATSAPP_WEBHOOK_URL,
                    "events": ["MESSAGES_UPSERT"],
                },
                "qrcode": True,
            },
        )
    else:
        await _evolution_proxy(
            "POST",
            f"/webhook/set/{EVOLUTION_INSTANCE_NAME}",
            json={
                "webhook": {
                    "url": WHATSAPP_WEBHOOK_URL,
                    "events": ["MESSAGES_UPSERT"],
                    "enabled": True,
                },
            },
        )

    _save_evolution_config()

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
async def whatsapp_status(_=Depends(_verify_api_key)):
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
            "qrread": "connecting",
            "init": "connecting",
            "authed": "connecting",
            "refused": "connecting",
            "timeout": "connecting",
            "conflict": "connecting",
        }
        state = state_map.get(raw.lower(), "idle")

        if state == "connecting":
            try:
                instances = await _evolution_proxy("GET", "/instance/fetchInstances")
                inst = next(
                    (i for i in instances if isinstance(i, dict) and i.get("name") == EVOLUTION_INSTANCE_NAME),
                    None,
                )
                if inst:
                    code = inst.get("disconnectionReasonCode")
                    obj = inst.get("disconnectionObject", "")
                    if code == 401 or (isinstance(obj, str) and "device_removed" in obj):
                        print(f"[WhatsApp] Sessao invalida detectada (401/device_removed), reportando idle")
                        state = "idle"
            except Exception:
                pass

        return {
            "state": state,
            "instanceName": EVOLUTION_INSTANCE_NAME,
        }
    except HTTPException as e:
        if e.status_code == 404 or "does not exist" in str(e.detail).lower():
            print(f"[WhatsApp] Instancia nao existe, reportando idle")
            return {"state": "idle", "instanceName": EVOLUTION_INSTANCE_NAME}
        print(f"[WhatsApp] HTTPException ao obter status: {e.detail}")
        return {"state": "error", "instanceName": EVOLUTION_INSTANCE_NAME, "error": str(e.detail)}
    except Exception as e:
        print(f"[WhatsApp] Erro inesperado ao obter status: {type(e).__name__}: {e}")
        return {"state": "error", "instanceName": EVOLUTION_INSTANCE_NAME, "error": "Nao foi possivel verificar o status do WhatsApp."}


@app.delete("/whatsapp/instance")
async def whatsapp_disconnect(_=Depends(_verify_api_key)):
    errors = []
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/logout/{EVOLUTION_INSTANCE_NAME}"
        )
    except HTTPException as e:
        errors.append(f"logout: {e.detail}")
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/delete/{EVOLUTION_INSTANCE_NAME}"
        )
    except HTTPException as e:
        errors.append(f"delete: {e.detail}")
    _clear_self_chat_jid()
    if errors:
        return {"detail": f"WhatsApp parcialmente desconectado. Erros: {'; '.join(errors)}"}
    return {"detail": "WhatsApp desconectado com sucesso."}


@app.put("/whatsapp/instance/pause")
async def whatsapp_pause(_=Depends(_verify_api_key)):
    try:
        await _evolution_proxy(
            "DELETE", f"/instance/logout/{EVOLUTION_INSTANCE_NAME}"
        )
        return {"state": "paused", "instanceName": EVOLUTION_INSTANCE_NAME}
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code, detail="Falha ao pausar WhatsApp.")


@app.put("/whatsapp/instance/resume")
async def whatsapp_resume(_=Depends(_verify_api_key)):
    connect_data = await _evolution_proxy(
        "GET", f"/instance/connect/{EVOLUTION_INSTANCE_NAME}"
    )
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


# ── Webhook da Evolution API ────────────────────────────
@app.post("/webhook/evolution")
async def evolution_webhook(request: Request):
    global _webhook_error_count
    body = await request.json()
    print(f"[Webhook] Evento recebido: {json.dumps(body, indent=2)[:2000]}")

    event = body.get("event", "")
    data = body.get("data", {})

    if event != "messages.upsert":
        return {"status": "ignored", "event": event}

    message = data.get("message", {})
    msg_type = message.get("messageType", message.get("type", ""))

    if not (msg_type in ("audio", "ptt", "audioMessage") or message.get("audioMessage")):
        return {"status": "ignored", "type": msg_type}

    key = data.get("key", {})
    remote_jid = key.get("remoteJid", "")
    is_from_me = key.get("fromMe", False)

    if not is_from_me:
        return {"status": "ignored", "reason": "not_self_chat"}

    if remote_jid.endswith("@g.us"):
        return {"status": "ignored", "reason": "group_chat"}

    if "@" not in remote_jid or not remote_jid.endswith("@s.whatsapp.net"):
        return {"status": "ignored", "reason": "not_individual_chat"}

    if SELF_CHAT_JID is None:
        _set_self_chat_jid(remote_jid)
    elif remote_jid != SELF_CHAT_JID:
        return {"status": "ignored", "reason": "not_self_chat"}

    message_ts = data.get("messageTimestamp")
    if isinstance(message_ts, (int, float)) and message_ts > 0:
        if message_ts < SERVER_START_TIME - 60:
            print(f"[Webhook] Mensagem antiga ignorada (ts={message_ts}, server_start={SERVER_START_TIME:.0f})")
            return {"status": "ignored", "reason": "old_message"}

    message_id = key.get("id", "")
    audio_number = _next_audio_number()
    number = remote_jid.split("@")[0]

    should_process, dup_reason = _dedup_try_start(message_id)
    if not should_process:
        print(f"[Webhook] Mensagem {message_id} ignorada: {dup_reason}")
        return {"status": "ignored", "reason": dup_reason}

    ack_text = (
        f"🎙️ Áudio #{audio_number} recebido às "
        f"{datetime.now(ZoneInfo('America/Sao_Paulo')).strftime('%H:%M:%S')} — transcrevendo..."
    )
    ack_quote: dict = {}
    if message_id:
        ack_quote = {"quotedMessage": {"key": {"id": message_id}}}
    try:
        await _evolution_proxy(
            "POST",
            f"/message/sendText/{EVOLUTION_INSTANCE_NAME}",
            json={"number": number, "text": ack_text, **ack_quote},
        )
        print(f"[Webhook] Ack #{audio_number} enviado para {number}")
    except Exception as ack_err:
        print(f"[Webhook] Falha ao enviar ack #{audio_number}: {ack_err}")

    audio_url = None
    audio_b64 = None
    audio_message = message.get("audioMessage") or message.get("audio", {})
    if audio_message:
        audio_url = audio_message.get("url") or audio_message.get("mediaUrl")
        audio_b64 = audio_message.get("base64")
    if not audio_b64:
        audio_b64 = message.get("base64")

    if not audio_url and not audio_b64:
        return {"status": "ignored", "reason": "no_audio_url"}

    try:
        import base64 as b64mod
        audio_bytes = None

        if audio_b64:
            b64_clean = audio_b64
            if "," in b64_clean:
                b64_clean = b64_clean.split(",", 1)[1]
            audio_bytes = b64mod.b64decode(b64_clean)
            print(f"[Webhook] Áudio via webhookBase64 ({len(audio_bytes)} bytes)")

        if audio_bytes is None:
            full_message = {"message": {"key": data.get("key", {}), "message": message}}
            try:
                media_resp = await _evolution_proxy(
                    "POST",
                    f"/chat/getBase64FromMediaMessage/{EVOLUTION_INSTANCE_NAME}",
                    json=full_message,
                )
                b64_data = media_resp.get("base64", "")
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]
                audio_bytes = b64mod.b64decode(b64_data)
                print(f"[Webhook] Áudio via getBase64FromMediaMessage ({len(audio_bytes)} bytes)")
            except Exception as media_err:
                print(f"[Webhook] getBase64FromMediaMessage falhou: {media_err}")

        if audio_bytes is None and audio_url:
            try:
                async with httpx.AsyncClient(timeout=300) as client:
                    audio_resp = await client.get(audio_url)
                    audio_resp.raise_for_status()
                audio_bytes = audio_resp.content
                print(f"[Webhook] Áudio via URL direta ({len(audio_bytes)} bytes)")
            except Exception as url_err:
                print(f"[Webhook] Download direto falhou: {url_err}")

        if audio_bytes is None or len(audio_bytes) == 0:
            return {"status": "ignored", "reason": "could_not_download_audio"}

        temp_path = f"temp_whatsapp_{uuid.uuid4().hex[:8]}.ogg"
        with open(temp_path, "wb") as f:
            f.write(audio_bytes)

        try:
            m = model_handle.acquire()
            try:
                segments_result, info = m.transcribe(
                    temp_path,
                    language=None if DEFAULT_LANGUAGE == "auto" else DEFAULT_LANGUAGE,
                    beam_size=DEFAULT_BEAM_SIZE,
                    temperature=DEFAULT_TEMPERATURE,
                    vad_filter=DEFAULT_VAD_FILTER,
                )
                full_text = "".join(seg.text for seg in segments_result).strip()
            finally:
                model_handle.release()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        if not full_text:
            full_text = "[Não foi possível transcrever o áudio]"

        quote_payload: dict = {}
        if message_id:
            quote_payload = {"quotedMessage": {"key": {"id": message_id}}}

        await _evolution_proxy(
            "POST",
            f"/message/sendText/{EVOLUTION_INSTANCE_NAME}",
            json={
                "number": number,
                "text": f"🗣️ #{audio_number} Transcrição:\n\n{full_text}",
                **quote_payload,
            },
        )

        print(f"[Webhook] Transcrição enviada para {number}")
        with _webhook_error_lock:
            _webhook_error_count = 0
        _dedup_complete(message_id)
        return {"status": "success", "text": full_text}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Webhook] Erro ao processar áudio: {type(e).__name__}")
        _dedup_fail(message_id)
        with _webhook_error_lock:
            should_reply = _webhook_error_count < _MAX_ERROR_REPLIES
            if should_reply:
                _webhook_error_count += 1
        if not should_reply:
            print(f"[Webhook] Limite de {_MAX_ERROR_REPLIES} mensagens de erro atingido, suprimindo reply.")
            raise HTTPException(status_code=500, detail="Erro interno ao processar áudio do webhook.")
        try:
            error_quote: dict = {}
            if message_id:
                error_quote = {"quotedMessage": {"key": {"id": message_id}}}
            remaining = _MAX_ERROR_REPLIES - _webhook_error_count
            suffix = f" ({remaining} aviso(s) restante(s))" if remaining > 0 else ""
            await _evolution_proxy(
                "POST",
                f"/message/sendText/{EVOLUTION_INSTANCE_NAME}",
                json={
                    "number": number,
                    "text": f"❌ #{audio_number} Não foi possível transcrever o áudio (erro: {type(e).__name__}). Verifique se o modelo está ativo ou tente novamente com um áudio mais curto.{suffix}",
                    **error_quote,
                },
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Erro interno ao processar áudio do webhook.")


# ── Frontend Estático ─────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
