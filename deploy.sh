#!/usr/bin/env bash
set -euo pipefail

# Deploy do frontend + backend para a VPS
# Requer: acesso SSH configurado para a VPS
# Uso:   bash deploy.sh

REMOTE_HOST="${SSH_HOST:?ERRO: defina SSH_HOST com o IP da VPS}"
REMOTE_USER="${SSH_USERNAME:?ERRO: defina SSH_USERNAME}"
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

echo "⚙️ Enviando configuração PM2 (ecosystem.config.cjs)..."
rsync -avz ecosystem.config.cjs "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/ecosystem.config.cjs"

echo "🔄 Reiniciando serviço whisper via PM2..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && pm2 delete whisper-api 2>/dev/null; pm2 start ecosystem.config.cjs --update-env"

echo "✅ Deploy concluído."
echo "🔗 http://${REMOTE_HOST}:8000"
