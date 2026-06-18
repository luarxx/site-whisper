# Comandos Úteis — VPS Whisper API

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
ssh ubuntu@163.176.197.25
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
