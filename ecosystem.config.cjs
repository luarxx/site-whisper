module.exports = {
  apps: [{
    name: 'whisper-api',
    script: './venv/bin/uvicorn',
    args: 'main:app --host 0.0.0.0 --port 8000',
    interpreter: './venv/bin/python',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
