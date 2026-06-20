# main.py — Whisper VPS API

Código atualizado do serviço de transcrição rodando na VPS (`SEU_IP:8000`).

## Stack

| Componente | Tecnologia |
|---|---|
| Framework | FastAPI |
| Motor Whisper | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (CTranslate2) |
| ASGI Server | Uvicorn |
| Python | 3.10+ |
| Infra | Ubuntu 22.04 / PM2 (substituiu systemd) |
## Código-fonte (`~/whisper-api/main.py`)

> O código-fonte atual está em [`main.py`](../main.py) na raiz do repositório.
> Abaixo, um resumo da arquitetura — consulte o arquivo real para a implementação completa.

### Configuração persistente

Desde jun/2026 o `main.py` persiste a configuração do modelo em disco via `whisper_config.json`
(no mesmo diretório). No startup, o arquivo é lido e mesclado com os defaults; se não existir,
usa os valores padrão (`small`/`cpu`/`int8`). Toda alteração via `POST /config` salva
automaticamente o JSON, garantindo que a configuração sobreviva a restart do serviço (OOM,
systemd, reboot).

A partir de jun/2026 também persiste a configuração da Evolution API (`evolution`) no mesmo arquivo:

```json
{
  "model": "small",
  "device": "cpu",
  ...
  "evolution": {
    "evolution_api_url": "http://localhost:8080",
    "evolution_api_key": "sua-api-key",
    "whatsapp_webhook_url": ""
  }
}
```

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
| `POST` | `/whatsapp/instance` | Criar/conectar instância Evolution API (retorna QR Code) |
| `GET` | `/whatsapp/instance` | Status da conexão WhatsApp |
| `DELETE` | `/whatsapp/instance` | Desconectar/logout da instância |
| `POST` | `/webhook/evolution` | Webhook para receber mensagens de áudio da Evolution API |

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

## Servindo o Frontend (StaticFiles)

Desde jun/2026 o `main.py` serve o build do React localizado em `static/` no mesmo diretório.
Se a pasta `static/` existir, o FastAPI monta um `StaticFiles` na raiz `/` com fallback SPA
(`html=True`), servindo `index.html` para qualquer rota que não seja da API.

O frontend é construído com `VITE_API_BASE_URL=""` (`.env.production`) para que as chamadas
à API usem caminhos relativos (same-origin). Isso dispensa nginx ou proxy reverso adicional.

Para deploy: faça `npm run build` e copie `dist/*` para `~/whisper-api/static/` na VPS.

### Estrutura de diretórios na VPS
```
~/whisper-api/
├── main.py
├── whisper_config.json
├── static/          ← Build do React (dist/)
│   ├── index.html
│   ├── assets/
│   └── ...
└── venv/
```

## Execução

### Desenvolvimento

```bash
ssh SEU_USUARIO@SEU_IP
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

> **Atenção:** Não use `--workers N` — o modelo Whisper é carregado na importação do módulo.
> Com múltiplos workers, cada processo carrega o modelo separadamente, quadruplicando o uso
> de RAM e atrasando o startup (causando timeout no health check do deploy).

### Produção (PM2 — recomendado)

```bash
cd ~/whisper-api
pm2 start ecosystem.config.cjs     # Iniciar (ou recriar se já existir)
pm2 restart whisper-api             # Reiniciar
pm2 stop whisper-api                # Parar
pm2 logs whisper-api -f             # Logs em tempo real
pm2 status                          # Status de todos os processos
```

> O `ecosystem.config.cjs` está versionado no repositório em `./ecosystem.config.cjs`.
> O deploy (GitHub Actions ou `deploy.sh`) envia o arquivo para a VPS e recria o processo
> via `pm2 delete whisper-api && pm2 start ecosystem.config.cjs --update-env`.

O PM2 está configurado para iniciar automaticamente com o sistema via `pm2-ubuntu.service`.
Logs salvos em `~/whisper-api/logs/{out,error}.log`.

> **Nota:** O antigo serviço systemd `whisper.service` foi desativado. A migração para PM2
> ocorreu em jun/2026 para facilitar a visualização de logs com `pm2 logs`.

## Compatibilidade com o Frontend

O frontend (`site-whisper`) está alinhado com os endpoints deste backend:

| Frontend (`api.ts`) | Backend (`main.py`) |
|---|---|
| `GET /health` | `GET /health` ✅ |
| `GET /config` | `GET /config` ✅ |
| `POST /config` | `POST /config` ✅ |
| `POST /v1/audio/transcriptions` | `POST /v1/audio/transcriptions` ✅ |
| `GET /logs?limit=N` | `GET /logs?limit=N` ✅ |
| `POST /whatsapp/instance` | `POST /whatsapp/instance` ✅ |
| `GET /whatsapp/instance` | `GET /whatsapp/instance` ✅ |
| `DELETE /whatsapp/instance` | `DELETE /whatsapp/instance` ✅ |

## Webhook da Evolution API

Quando o frontend cria a instância via `POST /whatsapp/instance`, o backend configura automaticamente a Evolution API para enviar webhooks para `POST /webhook/evolution`.

### Fluxo de transcrição automática

1. O usuário envia um áudio no self-chat ("Falar comigo mesmo")
2. A Evolution API dispara um webhook `messages.upsert` para o backend
3. O backend verifica se é áudio e se não é do próprio bot (evita loop)
4. Baixa o áudio via URL da Evolution API
5. Transcreve com Whisper
6. Envia a transcrição de volta no mesmo chat via Evolution API

### Configuração manual da Webhook

Se precisar configurar manualmente (Evolution API rodando antes da integração):

1. Acesse o painel da Evolution API
2. Adicione um webhook com URL `http://localhost:8000/webhook/evolution`
3. Ative o evento `messages.upsert`

Ou defina a webhook URL no `whisper_config.json`:

```json
{
  "evolution": {
    "whatsapp_webhook_url": "http://localhost:8000/webhook/evolution"
  }
}
```

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
httpx>=0.27
```

> A dependência `httpx` é necessária a partir da integração com Evolution API (proxy e webhook). Instale com `pip install httpx`.
