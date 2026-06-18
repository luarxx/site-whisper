# main.py — Whisper VPS API

Código atualizado do serviço de transcrição rodando na VPS (`163.176.197.25:8000`).

## Stack

| Componente | Tecnologia |
|---|---|
| Framework | FastAPI |
| Motor Whisper | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (CTranslate2) |
| ASGI Server | Uvicorn |
| Python | 3.10+ |
| Infra | Ubuntu 22.04 / systemd |
## Código-fonte (`~/whisper-api/main.py`)

> O código-fonte atual está em [`main.py`](../main.py) na raiz do repositório.
> Abaixo, um resumo da arquitetura — consulte o arquivo real para a implementação completa.

### Configuração persistente

Desde jun/2026 o `main.py` persiste a configuração do modelo em disco via `whisper_config.json`
(no mesmo diretório). No startup, o arquivo é lido e mesclado com os defaults; se não existir,
usa os valores padrão (`small`/`cpu`/`int8`). Toda alteração via `POST /config` salva
automaticamente o JSON, garantindo que a configuração sobreviva a restart do serviço (OOM,
systemd, reboot).

```python
# ── Configuração do Modelo ───────────────────────────────
CONFIG_FILE = "whisper_config.json"

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
    os.makedirs(os.path.dirname(CONFIG_FILE) or ".", exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Health check simples |
| `GET` | `/status` | Status do serviço + recursos do host |
| `GET` | `/config` | Configuração atual do modelo |
| `POST` | `/config` | Atualizar configuração e recarregar modelo (persistido em `whisper_config.json`) |
| `POST` | `/v1/audio/transcriptions` | Transcrição de áudio (OpenAI-compatible) |
| `GET` | `/logs` | Logs do servidor (via journald) |

## Formato da Transcrição (`POST /v1/audio/transcriptions`)

**Request:** `multipart/form-data`

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `file` | binary | sim | — | Arquivo de áudio (mp3, wav, m4a, ogg, flac) |
| `language` | string | não | `auto` | Código BCP-47 (`pt`, `en`, `es`) ou `auto` |
| `temperature` | float | não | `0.0` | Temperatura de sampling (0–1) |
| `beam_size` | int | não | `5` | Número de beams (1–10) |
| `vad_filter` | bool | não | `true` | Filtro de silêncio (VAD) |

**Response `200 OK`:**

```json
{
  "text": "Olá mundo, este é um teste de transcrição.",
  "language": "pt",
  "language_probability": 0.9912,
  "duration": 4.32,
  "segments": [
    { "id": 0, "start": 0.0, "end": 2.4, "text": "Olá mundo," },
    { "id": 1, "start": 2.4, "end": 4.32, "text": " este é um teste de transcrição." }
  ]
}
```

**Erro `500`:**

```json
{ "detail": "Mensagem descritiva do erro." }
```

## Execução

### Desenvolvimento

```bash
ssh ubuntu@163.176.197.25
cd ~/whisper-api
source venv/bin/activate
python main.py
```

### Produção (Uvicorn)

```bash
cd ~/whisper-api
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Serviço systemd (`whisper.service`)

```bash
sudo systemctl start whisper
sudo systemctl stop whisper
sudo systemctl restart whisper
sudo systemctl status whisper
sudo journalctl -u whisper -f
```

## Compatibilidade com o Frontend

O frontend (`site-whisper`) está alinhado com os endpoints deste backend:

| Frontend (`api.ts`) | Backend (`main.py`) |
|---|---|
| `GET /health` | `GET /health` ✅ |
| `GET /config` | `GET /config` ✅ |
| `POST /config` | `POST /config` ✅ |
| `POST /v1/audio/transcriptions` | `POST /v1/audio/transcriptions` ✅ |
| `GET /logs?limit=N` | `GET /logs?limit=N` ✅ |

## Modelos Disponíveis

| Modelo | Parâmetros | Disco | RAM (aprox.) | Qualidade |
|---|---|---|---|---|
| `tiny` | 39 M | ~150 MB | ~1 GB | Baixa |
| `base` | 74 M | ~290 MB | ~1 GB | Média-baixa |
| `small` | 244 M | ~950 MB | ~2 GB | Média (✓ atual) |
| `medium` | 769 M | ~3 GB | ~5 GB | Alta |
| `large-v3` | 1.55 B | ~6 GB | ~10 GB | Máxima |

## Dependências (`requirements.txt`)

```
fastapi>=0.110
uvicorn[standard]>=0.29
faster-whisper>=1.0
psutil>=5.9
python-multipart>=0.0.9
```
