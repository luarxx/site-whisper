#!/usr/bin/env bash
set -euo pipefail

# Deploy do frontend + backend para a VPS
# Requer: acesso SSH configurado para a VPS
# Uso:   bash deploy.sh

REMOTE_HOST="${SSH_HOST:-SEU_IP}"
REMOTE_USER="${SSH_USERNAME:-SEU_USUARIO}"
REMOTE_DIR="~/whisper-api"

echo "📦 Build do frontend..."
npm ci --silent
npm run build

echo "📂 Criando diretório static na VPS..."
ssh -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/static"

echo "🚀 Enviando frontend (dist/)..."
rsync -avz --delete dist/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/static/"

echo "🐍 Enviando backend (main.py)..."
rsync -avz main.py "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/main.py"

echo "🔄 Reiniciando serviço whisper..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "sudo systemctl restart whisper"

echo "✅ Deploy concluído."
echo "🔗 http://${REMOTE_HOST}:8000"
