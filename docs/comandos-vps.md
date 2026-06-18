# Comandos Úteis — VPS Whisper API

## Deploy Automático (GitHub Actions)

O deploy é automático ao fazer push para `main`. O workflow `.github/workflows/deploy.yml`:
1. Faz build do frontend (`dist/`)
2. Envia `dist/` → `~/whisper-api/static/`
3. Envia `main.py` → `~/whisper-api/`
4. Reinicia o serviço `whisper`

**Secrets necessários no GitHub** (`Settings > Secrets and variables > Actions`):

| Secret | Valor |
|---|---|
| `SSH_HOST` | IP da VPS |
| `SSH_USERNAME` | usuário SSH (ex: `ubuntu`) |
| `SSH_PRIVATE_KEY` | Conteúdo da chave privada SSH |

## Deploy Manual

```bash
# Do diretório do projeto:
bash deploy.sh
```

Ou passo a passo:

```bash
# Build local
npm run build

# Enviar frontend
scp -r dist/* SEU_USUARIO@SEU_IP:~/whisper-api/static/

# Enviar backend
scp main.py SEU_USUARIO@SEU_IP:~/whisper-api/main.py

# Reiniciar
ssh SEU_USUARIO@SEU_IP "sudo systemctl restart whisper"
```

Acesse em `http://SEU_IP:8000` — o FastAPI serve o frontend React + API no mesmo host.

## Gerenciamento do Serviço (systemd)

```bash
sudo systemctl start whisper      # Iniciar
sudo systemctl stop whisper       # Parar
sudo systemctl restart whisper    # Reiniciar
sudo systemctl status whisper     # Ver status
sudo journalctl -u whisper -f     # Ver logs em tempo real
```

## Rodar Manualmente (para debug)

```bash
ssh SEU_USUARIO@SEU_IP
cd ~/whisper-api
source venv/bin/activate
python main.py
```

## Ver Rotas da API

```bash
cd ~/whisper-api
source venv/bin/activate
python -c "from main import app; [print(r.methods, r.path) for r in app.routes]"
```

## Testar a API Localmente (via SSH)

```bash
# Health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs

# Transcrição
curl -s -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -w "\nHTTP %{http_code}"
```

## Editar Código

```bash
nano ~/whisper-api/main.py
```

## Verificar Porta

```bash
ss -tlnp | grep 8000
```

---

## Evolution API (WhatsApp)

### Instalação via Node.js (sem Docker)

```bash
# 1. Verificar Node.js (precisa >= 18)
node --version

# Se não tiver Node, instalar:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clonar o repositório
git clone https://github.com/EvolutionAPI/evolution-api.git /opt/evolution-api
cd /opt/evolution-api

# 3. Instalar dependências
npm install

# 4. Configurar
cp .env.example .env
nano .env
```

Edite o `.env` com estes valores mínimos:

```env
PORT=8080
AUTHENTICATION_API_KEY=sua-api-key-evolution
DATABASE_ENABLED=true
DATABASE_PROVIDER=sqlite
DATABASE_CONNECTION_URI=file:/opt/evolution-api/evolution.db
LOG_LEVEL=info
```

```bash
# 5. Rodar
npm run start
```

### Criar serviço systemd

Para a Evolution rodar automaticamente como serviço:

```bash
sudo nano /etc/systemd/system/evolution-api.service
```

Cole:

```ini
[Unit]
Description=Evolution API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/evolution-api
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Ativar e iniciar
sudo systemctl daemon-reload
sudo systemctl enable evolution-api
sudo systemctl start evolution-api
sudo systemctl status evolution-api
```

### Logs

```bash
sudo journalctl -u evolution-api -f
```

### API Key

A chave definida em `AUTHENTICATION_API_KEY` (ex: `sua-api-key-evolution`) é a mesma usada no dashboard, seção WhatsApp.

### Atualizar

```bash
cd /opt/evolution-api
git pull
npm install
sudo systemctl restart evolution-api
```
