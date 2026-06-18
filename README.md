# Whisper Control — Dashboard

Painel de controle em **React + TypeScript + Tailwind CSS** para gerenciar e configurar uma API baseada em [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper) hospedada em uma VPS (Ubuntu).

## ✨ Funcionalidades

- **A. Status & Monitoramento** — Badge Online/Offline, latência, uptime, modelo ativo, consumo de CPU/Memória/GPU.
- **B. Configuração do Modelo** — Modelo, device, compute_type, idioma, beam_size, temperatura (slider) e VAD.
- **C. Transcrição Rápida** — Drag-and-drop de áudio (mp3, wav, m4a, ogg, flac), botão de processar, copiar resultado.
- **D. Terminal de Logs** — Visual estilo console com auto-refresh, filtro, autoscroll e pausa.
- **Configurável** — URL base da API pode ser alterada no próprio painel (campo de texto) e persistida em `localStorage`.

## 🧱 Stack

| Camada | Tecnologia |
| --- | --- |
| Build | Vite 5 |
| UI | React 18 + TypeScript (strict) |
| Estilização | Tailwind CSS 3 |
| Estado | Zustand (com `persist`) |
| HTTP | Axios |
| Ícones | Lucide React |
| Utilitários | `clsx` + `tailwind-merge` |

## 🚀 Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# edite VITE_API_BASE_URL=http://<IP_DA_VPS>:8000

# 3. Dev server
npm run dev          # http://localhost:5173

# 4. Build de produção
npm run build
npm run preview
```

## 📁 Estrutura de pastas

```
src/
├── components/
│   ├── ui/                  # primitives reutilizáveis
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Field.tsx
│   │   ├── Select.tsx
│   │   ├── Slider.tsx
│   │   └── Toaster.tsx
│   ├── Sidebar.tsx
│   ├── StatusCard.tsx
│   ├── ConfigForm.tsx
│   ├── AudioUploader.tsx
│   └── LogViewer.tsx
├── services/
│   └── api.ts               # Axios client + endpoints
├── store/
│   └── useAppStore.ts       # Zustand global state
├── types/
│   └── index.ts             # contratos TS (WhisperConfig, ApiStatus, ...)
├── utils/
│   └── index.ts             # cn(), formatUptime(), formatBytes(), ...
├── App.tsx
├── main.tsx
└── index.css
```

## 🔌 Contrato esperado da API (Python · `main.py`)

O front espera que o `main.py` (FastAPI, recomendado) exponha os endpoints abaixo. Os tipos TypeScript correspondentes ficam em [`src/types/index.ts`](./src/types/index.ts).

### `GET /status`

Retorna o estado atual do serviço, configuração em uso e recursos do host.

**Resposta `200 OK`**

```json
{
  "online": true,
  "version": "1.0.0",
  "uptime_seconds": 7325,
  "latency_ms": 42.7,
  "resources": {
    "cpu_percent": 12.4,
    "memory_percent": 38.1,
    "gpu_percent": 22.0,
    "gpu_name": "NVIDIA L4"
  },
  "current_config": {
    "model": "small",
    "device": "cpu",
    "compute_type": "int8",
    "language": "auto",
    "temperature": 0.0,
    "beam_size": 5,
    "vad_filter": true
  }
}
```

### `GET /config`

Retorna a configuração persistida (idem `current_config` acima).

### `POST /config`

Atualiza a configuração. Após aplicar, o backend deve recarregar o modelo em memória.

**Request**

```json
{
  "model": "medium",
  "device": "cuda",
  "compute_type": "float16",
  "language": "pt",
  "temperature": 0.1,
  "beam_size": 5,
  "vad_filter": true
}
```

**Resposta `200 OK`** — objeto `WhisperConfig` aplicado.

### `POST /transcribe`

`multipart/form-data` com os campos:

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `file` | `UploadFile` | sim | Áudio de entrada |
| `language` | `string` | não | Código BCP-47 (`pt`, `en`, …) ou vazio para auto |
| `temperature` | `float` | não | `0.0`–`1.0` |

**Resposta `200 OK`**

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

### `GET /logs?limit=200`

Retorna as últimas linhas de log do servidor.

**Resposta `200 OK`**

```json
{
  "lines": [
    { "timestamp": "2026-06-17 10:42:18", "level": "INFO",  "message": "Modelo 'small' carregado em 1.2s (cpu/int8)." },
    { "timestamp": "2026-06-17 10:42:25", "level": "INFO",  "message": "POST /transcribe 200 3.41s" },
    { "timestamp": "2026-06-17 10:42:33", "level": "WARN",  "message": "Áudio com SNR baixo (12 dB)." }
  ],
  "total": 1248
}
```

### Erros

Todos os erros devem retornar `application/problem+json` no formato:

```json
{ "detail": "Modelo 'huge' não existe.", "code": "INVALID_MODEL" }
```

## 🐍 Esqueleto sugerido para `main.py`

```python
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psutil, time

app = FastAPI(title="Whisper API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # restrinja em produção
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG = {
    "model": "small",
    "device": "cpu",
    "compute_type": "int8",
    "language": "auto",
    "temperature": 0.0,
    "beam_size": 5,
    "vad_filter": True,
}
START = time.time()

@app.get("/status")
def status():
    import torch
    gpu = None
    if torch.cuda.is_available():
        gpu = torch.cuda.utilization_percent()
    return {
        "online": True,
        "version": app.version,
        "uptime_seconds": time.time() - START,
        "latency_ms": 0.0,           # meça via middleware
        "resources": {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "gpu_percent": gpu,
            "gpu_name": torch.cuda.get_device_name(0) if gpu is not None else None,
        },
        "current_config": CONFIG,
    }

@app.get("/config")
def get_config(): return CONFIG

@app.post("/config")
def set_config(patch: dict):
    CONFIG.update(patch)
    # >>> recarregar modelo aqui <<<
    return CONFIG

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form(""),
    temperature: float = Form(0.0),
):
    # >>> chamar faster_whisper.WhisperModel.transcribe(...) <<<
    return {
        "text": "...",
        "language": language or "pt",
        "language_probability": 0.99,
        "duration": 0.0,
        "segments": [],
    }
```

## 🛡️ CORS

Como o front roda em `http://localhost:5173` e a API normalmente em outra porta/host, habilite CORS no backend (já incluso no esqueleto acima). Em produção, sirva o build estático (`dist/`) atrás do mesmo Nginx/Apache que serve a API, ou use um proxy reverso.

## 📜 Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Sobe o Vite em modo desenvolvimento |
| `npm run build` | Faz o typecheck (`tsc -b`) e gera o build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Apenas typecheck |
