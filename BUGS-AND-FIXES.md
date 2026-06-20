# Bugs & Fixes

Registro de bugs encontrados, causas raiz e solucoes aplicadas. O agente deve consultar este arquivo ao encontrar erros similares para evitar repetir padroes conhecidos.

---

## Template

```
### [DATA] Titulo curto

**Sintoma:** O que foi observado (mensagem de erro, comportamento).

**Causa:** Diagnostico final.

**Solucao:** O que resolveu (commit, arquivo, abordagem).

**Arquivos afetados:** `src/...`, `main.py`

**Tags:** `frontend` `backend` `api` `build` `css` `types` `state` `store`
```

---

## Historico

### 2026-06-19 VPS troca de modelo sozinha + config do formulário afeta WhatsApp

**Sintoma:** O modelo exibido no frontend "revertia sozinho" para um menor (ex: small) após alteração. Usuário também questionava se alterar o modelo no formulário de Configurações afetava a transcrição de áudios do WhatsApp.

**Causa:** Dois problemas:
1. **Backend:** Quando o modelo grande causava OOM crash, o systemd reiniciava o processo. O `_check_crash_and_recover()` forçava `SAFE_DEFAULTS` (small/cpu/int8) sem tentar restaurar o último modelo que havia funcionado. Se o usuário configurasse medium/large, crashava, e voltava para small — um loop potencial.
2. **Frontend:** O polling de 30s em `refreshConfig()` comparava `configDraft` com `config` para detectar edições locais, mas após salvar (`saveConfig`), a próxima chamada de polling chegava com o modelo antigo (servidor ainda reiniciando) e sobrescrevia o draft, causando reversão visual do Select.

**Solucao:**
1. **Backend:** Adicionado arquivo `whisper_last_good.json` que salva a última configuração que carregou com sucesso. Se crashar, o sistema restaura esse `last_known_good` antes de cair nos `SAFE_DEFAULTS`. Também salva `last_known_good` após reload bem-sucedido via `POST /config`.
2. **Frontend:** Adicionado `lastSavedConfig` no store. Após `saveConfig()`, o valor salvo é gravado em `lastSavedConfig`. No `refreshConfig()`, se o novo config do servidor é igual ao `lastSavedConfig` (servidor já processou a mudança), o draft é atualizado normalmente. Se diferente (servidor ainda reiniciando), preserva o draft local — evitando reversão visual.

**Arquivos afetados:** `main.py`, `src/store/useAppStore.ts`

**Tags:** `backend` `frontend` `state` `config` `whatsapp`

### 2026-06-19 WhatsApp status retorna "idle" mesmo conectado (Evolution API v2.3.7)

**Sintoma:** O endpoint `GET /whatsapp/instance` retornava `{"state":"idle"}` apesar da instância estar conectada (`connectionStatus: "open"` na Evolution API). O frontend mostrava "Desconectado" e o QR Code aparecia desnecessariamente.

**Causa:** A Evolution API v2.3.7 retorna o estado da conexão aninhado: `{"instance": {"state": "open"}}`. A função `_extract_whatsapp_state()` só verificava `data.get("state")` no nível raiz, que retornava `None` → fallback `"close"` → mapeado para `"idle"`.

**Solucao:** Adicionar verificação para `data["instance"]["state"]` e `data["instance"]["connectionState"]` na função `_extract_whatsapp_state()`.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp`

### 2026-06-19 Frontend expõe campos de URL e API Key da Evolution API

**Sintoma:** O painel WhatsApp mostrava campos editáveis para "URL da Evolution API" e "API Key", exigindo que o usuário preenchesse manualmente. Esses valores já estavam configurados no backend (`whisper_config.json`) e não deveriam ser expostos.

**Causa:** Os campos foram adicionados ao `WhatsAppPanel.tsx` originalmente para flexibilidade, mas a configuração correta já vive no backend (variáveis globais + `whisper_config.json`).

**Solucao:** Removidos os campos do frontend,简化 `WhatsAppConfig` (removido do store, types e API client), e ajustado `POST /whatsapp/instance` no backend para aceitar body vazio (`Body(default={})`). O endpoint continua aceitando `evolutionApiUrl`/`apiKey` no body para backward compatibility.

**Arquivos afetados:** `src/components/WhatsAppPanel.tsx`, `src/store/useAppStore.ts`, `src/services/api.ts`, `src/types/index.ts`, `main.py`

**Tags:** `frontend` `backend` `api` `whatsapp` `ui`

### 2026-06-19 Áudio do WhatsApp não é transcrito (webhook ignorava self-chat + remoteJid em formato errado)

**Sintoma:** Áudio enviado no self-chat ("Falar comigo mesmo") era recebido pelo webhook (200 OK) mas nunca transcrito. Nenhuma transcrição era enviada de volta.

**Causa:** Dois bugs encadeados:
1. O código lia `key = message.get("key", {})` mas a Evolution API v2.3.7 retorna `key` no nível `data`, não dentro de `message`. Resultado: `is_from_me` sempre `False` → mensagem ignorada com `"reason": "not_self_chat"`.
2. O `remote_jid` (formato `5511912255749@s.whatsapp.net`) era enviado diretamente ao `sendText` como `number`, mas a API espera apenas o número de telefone (`5511912255749`).

**Solucao:** (1) Alterar para `key = data.get("key", {})`. (2) Extrair número com `remote_jid.split("@")[0]`. (3) Adicionar download de mídia via `getBase64FromMediaMessage` como fallback para URLs encriptadas do WhatsApp CDN.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp` `webhook`

### 2026-06-19 Áudio chega no webhook mas é ignorado por messageType="audioMessage"

**Sintoma:** Webhook é recebido pelo Whisper (retorna 200), mas o áudio nunca é baixado/transcrito. Logs mostram o evento `messages.upsert` com `audioMessage` mas nenhuma ação subsequente.

**Causa:** A Evolution API envia `messageType: "audioMessage"` no payload do webhook. O handler em `/webhook/evolution` verificava `msg_type not in ("audio", "ptt")`, e como `"audioMessage"` não está nessa lista, retornava `{"status": "ignored", "type": "audioMessage"}` prematuramente.

**Solucao:** Adicionar `"audioMessage"` à lista de tipos aceitos e também verificar se o objeto `message` contém um campo `audioMessage` diretamente.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp` `webhook`

### 2026-06-19 Áudio do WhatsApp não é transcrito (webhook não configurado + self-chat ignorado)

**Sintoma:** Ao enviar áudio no self-chat do WhatsApp, a Evolution API recebe a mensagem mas o Whisper nunca processa. Nenhuma transcrição é retornada.

**Causa:** Duas causas:
1. `WHATSAPP_WEBHOOK_URL` estava vazio (`""`) no `main.py`. O `POST /whatsapp/instance` só configurava webhook na Evolution API se essa URL fosse preenchida, mas nunca era.
2. O webhook (`/webhook/evolution`) ignorava mensagens com `fromMe: true`, exatamente o caso do self-chat ("falar comigo mesmo").

**Solucao:**
1. `POST /whatsapp/instance` agora define automaticamente `WHATSAPP_WEBHOOK_URL = "http://localhost:8000/webhook/evolution"` e sempre inclui o webhook na criação da instância. Se a instância já existe, faz `PUT /instance/settings/{name}` para atualizar o webhook.
2. Invertida a lógica do `fromMe`: agora só transcreve mensagens com `fromMe: true` (self-chat), ignorando mensagens de terceiros.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp`

### 2026-06-18 Config do modelo reverte após crash/restart do servidor

**Sintoma:** Ao alterar o modelo no formulário de Configurações (ex: para `large-v2`), após um tempo o frontend mostra o modelo revertido para um modelo menor (`small`). O comportamento ocorre principalmente quando o VPS não tem RAM suficiente para carregar modelos maiores e o processo morre com OOM, sendo reiniciado pelo systemd.

**Causa:** O `main.py` armazenava `MODEL_SIZE` apenas em memória (variável global). `POST /config` alterava a variável e recarregava o modelo, mas se o processo crashasse (OOM ao carregar modelo grande) e o systemd reiniciasse, o Python partia do default fixo `MODEL_SIZE = "small"` — a configuração não era persistida em disco.

**Solucao:** Adicionar persistência via JSON (`whisper_config.json`). Um `_save_config()` grava o JSON após cada `POST /config`, e `_load_config()` é chamado no startup para restaurar a última configuração salva, com fallback para os defaults.

**Arquivos afetados:** `main.py`, `docs/main-vps.md`, `.gitignore`

**Tags:** `backend` `api`

### 2026-06-18 Polling sobrescreve configDraft e reverte seletor de modelos

**Sintoma:** Após alterar e salvar o modelo no formulário de Configurações, o seletor de modelos (`<Select>`) volta a exibir o modelo anterior esporadicamente. O `AudioUploader` também mostra o badge desatualizado.

**Causa:** O `refreshConfig()` chamado pelo polling de 30s em `App.tsx` sempre faz `set({ config, configDraft: structuredClone(config) })`, sobrescrevendo o `configDraft` mesmo quando o usuário acabou de salvar. Se o servidor ainda está reiniciando o modelo e retorna a config antiga, o `configDraft` perde o valor recém-salvo e o Select reverte.

**Solucao:** Em `refreshConfig()`, comparar `configDraft` com `config` antes de sobrescrever. Se houver edições locais pendentes (`configDraft !== config`), atualizar apenas `config` e preservar o rascunho. Caso contrário, atualizar ambos normalmente.

**Arquivos afetados:** `src/store/useAppStore.ts`

**Tags:** `frontend` `state` `store`

---

### 2026-06-17 Badge de modelo só aparece após visitar Configurações

**Sintoma:** O badge com o nome do modelo ativo (ex: "Large v2") no componente `AudioUploader` só aparece depois que o usuário navega até a aba "Configurações" e volta.

**Causa:** A store (`useAppStore`) inicializa `config: null`. O único lugar que chamava `refreshConfig()` para popular o dado era o `ConfigForm` ao montar. O `AudioUploader` renderiza o badge condicionalmente com `{config && (...)}` — como `config` nunca era carregado na inicialização, o badge ficava invisível até o `ConfigForm` montar.

**Solucao:** Adicionar `refreshConfig()` no `useEffect` de inicialização em `App.tsx`, lado a lado com `checkConnection()`, e também no intervalo de polling de 30s. Agora o config é carregado globalmente desde o start.

**Arquivos afetados:** `src/App.tsx`

**Tags:** `frontend` `state` `store`

### 2026-06-18 Crash loop do OOM killer ao carregar modelo grande

**Sintoma:** Ao salvar um modelo grande (`medium`, `large-v3`) no formulário de Configurações em uma VPS com pouca RAM, o serviço cai e nunca mais volta. O systemd reinicia o processo, que tenta carregar o mesmo modelo grande novamente → OOM kill → loop infinito.

**Causa:** O kernel Linux envia `SIGKILL` (OOM kill) quando o processo consome RAM demais. Isso não é uma exceção Python — o `except Exception` nunca roda. No restart, `_load_config()` lê `whisper_config.json` com o modelo grande salvo, repete o carregamento, e o ciclo recomeça.

**Solucao:** Adicionado mecanismo de detecção de crash via arquivo marcador `.whisper_startup`. Antes de carregar o modelo, o marcador é escrito com timestamp. Se no próximo startup o marcador existe e tem menos de 120s, o sistema força safe defaults (`small`/`cpu`/`int8`) e salva em disco. Após carregamento bem-sucedido, o marcador é removido. Também adicionada limpeza de `temp_*` no startup para remover arquivos órfãos de crashes anteriores.

**Arquivos afetados:** `main.py`, `.gitignore`

**Tags:** `backend` `api`

### 2026-06-18 apiBaseUrl persistido corrompe chamadas em produção

**Sintoma:** Após visitar o app em desenvolvimento (`localhost:5173`, `apiBaseUrl`="http://localhost:8000"), ao acessar a versão de produção (`http://SEU_IP:8000`) no mesmo navegador, todas as chamadas à API vão para `http://localhost:8000` (que não existe no browser do usuário).

**Causa:** Zustand `persist` salva `apiBaseUrl` no `localStorage`. Em produção `VITE_API_BASE_URL`="" (same-origin), mas o `localStorage` restaura o valor da sessão dev (`http://localhost:8000`), sobrescrevendo o valor correto.

**Solucao:** Adicionada função `merge` no middleware `persist` do Zustand. Quando `VITE_API_BASE_URL` está vazio (produção), o `merge` força `apiBaseUrl` para string vazia, ignorando o valor persistido. Em desenvolvimento (`VITE_API_BASE_URL` definido), o valor persistido é respeitado normalmente.

**Arquivos afetados:** `src/store/useAppStore.ts`

**Tags:** `frontend` `state` `store`

### 2026-06-18 Arquivos temporários acumulam após crash durante transcrição

**Sintoma:** Arquivos como `temp_AUD-20260612-WA0071.opus` e `temp_tendi\ nada.ogg` permanecem no diretório `~/whisper-api/` da VPS após crashes.

**Causa:** Quando o processo é morto por OOM durante `model.transcribe()`, o bloco `finally` que remove o arquivo temporário nunca executa. A barra invertida (`\`) no nome do arquivo indica que o cliente enviou um caminho Windows como filename, que não é sanitizado.

**Solucao:** (1) Adicionada função `_cleanup_temp_files()` que remove todos os `temp_*` no startup. (2) Sanitização do `file.filename` nos endpoints de transcrição: usa `os.path.basename()` para remover caminhos e substitui backslashes por underscores. (3) Adicionado UUID curto ao nome do temp file para evitar colisões.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api`

### 2026-06-19 WhatsApp "Invalid integration" ao criar instância

**Sintoma:** Ao criar instância WhatsApp no dashboard, retorna "Falha ao conectar WhatsApp: Invalid integration". Log da evolution-api: `ERROR [InstanceController] Invalid integration`.

**Causa:** O `main.py` faz `POST /instance/create` sem o campo `integration`. Evolution API v2.3.7 exige este campo (ex: `"WHATSAPP-BAILEYS"`). Sem ele, `channel.controller.init()` retorna `null` → `BadRequestException`.

**Solucao:** Adicionar `"integration": "WHATSAPP-BAILEYS"` ao JSON do `POST /instance/create` em `main.py`.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api`

### 2026-06-19 "This name 'whisper-bot' is already in use" após refresh

**Sintoma:** Ao criar instância WhatsApp, funciona. Após refresh da página, clicar "Conectar" retorna erro.

**Causa:** A verificação `exists` em `main.py` usava `inst.get("instance", {}).get("name")` mas a Evolution API v2.3.7 retorna objetos flat (`{ name: "whisper-bot" }`).

**Solucao:** Alterar para `inst.get("name")` compatível com formato da v2.3.7.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api`

### 2026-06-19 QR code não renderiza (imagem quebrada)

**Sintoma:** Após criar instância, o QR code aparece como broken image.

**Causa:** Evolution API v2.3.7 retorna `base64` já prefixado (`data:image/png;base64,...`). O frontend concatenava outro prefixo, gerando URL inválida.

**Solucao:** Detectar prefixo `data:` e só prefixar quando ausente.

**Arquivos afetados:** `src/components/WhatsAppPanel.tsx`

**Tags:** `frontend` `ui`

### 2026-06-19 WhatsApp "não foi possível conectar o dispositivo" ao escanear QR

**Sintoma:** Ao escanear o QR Code no WhatsApp, o app exibe "não foi possível conectar o dispositivo". A instância fica em loop de reconexão (status "connecting") sem nunca conectar.

**Causa:** A instância `whisper-bot` ficava com estado corrompido na Evolution API após múltiplas tentativas de conexão falhas (possivelmente devido ao campo `integration` ausente nas tentativas anteriores). Mesmo após corrigir o `main.py`, a instância antiga persistia com dados de auth inconsistentes no banco PostgreSQL.

**Solucao:** Deletar a instância corrompida via `DELETE /instance/delete/whisper-bot` na Evolution API e recriar via `POST /instance/create`. A nova instância gera QR Code limpo e conecta normalmente. Também atualizado o Baileys de `7.0.0-rc.9` para `7.0.0-rc10` no `/opt/evolution-api/` como medida preventiva.

**Arquivos afetados:** Evolution API (infra/VPS)

**Tags:** `backend` `infra` `whatsapp`

### 2026-06-19 QR code não some e botões não aparecem após scan

**Sintoma:** Após escanear o QR code e conectar no WhatsApp, o frontend continua exibindo o QR code e não mostra os botões de Pausar/Desconectar. A badge permanece "Conectando..." indefinidamente.

**Causa:** O `state_map` em `GET /whatsapp/instance` (`main.py`) só mapeava `open`, `connecting`, `close`, `disconnected`. Estados intermediários da Evolution API após o scan (`qrRead`, `init`, `authed`, etc.) caíam no fallback `state_map.get(raw, "error")` → frontend recebia `"error"` → o polling parava (efeito condicionado em `whatsAppState !== 'connecting'`) → a UI ficava travada no estado `connecting` com QR visível.

**Solucao:** (1) Adicionada função `_extract_whatsapp_state()` que lida com resposta string pura, dict com `state`, dict com `connectionState` e dict com `status`. (2) Adicionados mapeamentos para estados intermediários (`qrRead`, `init`, `authed`, `refused`, `timeout`, `conflict`) todos → `"connecting"`, mantendo o polling ativo até chegar em `"open"`. Fallback de `.get(raw, "connecting")` em vez de `"error"`. (3) No frontend, `checkWhatsAppStatus` não limpa `whatsAppQrCode` nem muda estado para `idle`/`error` enquanto o estado atual for `connecting` — evitando que erros transientes do backend derrubem o QR. (4) `except Exception` adicionado no backend para capturar crashes de parsing (ex: `AttributeError` ao chamar `.get()` em string).

**Arquivos afetados:** `main.py`, `src/store/useAppStore.ts`

**Tags:** `backend` `frontend` `api` `whatsapp` `state`

### 2026-06-19 Auditoria B-006: Upload sem limite de tamanho (DoS)

**Sintoma:** Endpoint `POST /v1/audio/transcriptions` aceita qualquer tamanho de arquivo, permitindo exaustão de disco.

**Causa:** `UploadFile` do FastAPI não impõe limite de tamanho por padrão.

**Solucao:** Adicionada constante `MAX_UPLOAD_BYTES = 100 * 1024 * 1024` (100 MB) e verificação `len(contents) > MAX_UPLOAD_BYTES` antes de escrever o arquivo temporário no disco. Retorna HTTP 413 com mensagem descritiva.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `security`

### 2026-06-19 Auditoria B-007: Chave Evolution API em texto plano no disco

**Sintoma:** A chave da Evolution API era persistida em `whisper_config.json` em texto plano, acessível a qualquer processo na VPS.

**Causa:** `_save_evolution_config()` gravava `evolution_api_key` junto com dados não sensíveis no JSON.

**Solucao:** (1) `EVOLUTION_API_KEY` agora é lida primeiro de `os.getenv("EVOLUTION_API_KEY")`, com fallback para o valor em disco (para backward compatibility). (2) `_save_evolution_config()` não persiste mais a chave — grava apenas `evolution_api_url` e `whatsapp_webhook_url`. (3) Adicionada variável `EVOLUTION_API_KEY` ao `.env.example` para documentação.

**Arquivos afetados:** `main.py`, `.env.example`

**Tags:** `backend` `api` `security`

### 2026-06-19 Auditoria B-009: AttributeError no whatsapp_resume

**Sintoma:** `PUT /whatsapp/instance/resume` crashava com 500 quando a Evolution API retornava resposta não-dict (string, lista).

**Causa:** `connect_data.get("base64")` assumia que `connect_data` era dict, mas `_evolution_proxy` pode retornar qualquer tipo. O padrão `isinstance` já existia em `whatsapp_create_instance` mas não foi propagado para `resume`.

**Solucao:** Adicionadas verificações `isinstance(connect_data, str)` e `isinstance(connect_data, dict)` antes de acessar `.get()`, espelhando o padrão de `whatsapp_create_instance`.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp`

### 2026-06-19 Auditoria F-001: Stale closure no teclado do AudioUploader

**Sintoma:** Ctrl+Enter usava opções de transcrição obsoletas (`transcribeOpts`) porque o `useEffect` não incluía `handleTranscribe` nas dependências.

**Causa:** O `useEffect` do listener de teclado tinha `[state, isOnline, isTranscribing, cancelTranscription]` como dependências, mas chamava `handleTranscribe()` que lia `transcribeOpts`. Como `handleTranscribe` não era dependência, o listener nunca era re-registrado quando as opções mudavam.

**Solucao:** (1) Movido `useEffect` para após a definição de `handleTranscribe`. (2) Adicionado `handleTranscribe` ao array de dependências do `useEffect`.

**Arquivos afetados:** `src/components/AudioUploader.tsx`

**Tags:** `frontend` `state` `store`

### 2026-06-19 Auditoria B-005: Corrida TOCTOU no _save_config

**Sintoma:** `_save_config` fazia read-modify-write sem proteção contra concorrência. Duas requisições `POST /config` simultâneas podiam sobrescrever mudanças uma da outra.

**Causa:** Ciclo read-modify-write sem bloqueio de arquivo ou escrita atômica.

**Solucao:** Implementada escrita atômica usando arquivo temporário (`.tmp`) e `os.replace()` que é atômico no POSIX.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `concurrency`

### 2026-06-19 Auditoria B-008: Detalhes de exceção expostos em 500

**Sintoma:** Mensagens de erro Python eram enviadas diretamente ao cliente em respostas 500, expondo caminhos internos e detalhes de bibliotecas.

**Causa:** `str(e)` era passado diretamente para `HTTPException(detail=str(e))` sem sanitização.

**Solucao:** Exceções agora são logadas no servidor com `traceback.print_exc()` e o cliente recebe mensagem genérica ("Erro interno ao processar transcrição.").

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `security`

### 2026-06-19 Auditoria B-010: GET /whatsapp/instance mascarava erros

**Sintoma:** Qualquer exceção em `whatsapp_status` retornava `{"state": "idle"}`, tornando impossível distinguir "desconectado" de "erro de conexão".

**Causa:** Catch-all `except Exception` retornava fallback `"idle"` para evitar crashes no frontend.

**Solucao:** Erros agora retornam `{"state": "error", "error": "descrição"}` em vez de mascarar como "idle".

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp`

### 2026-06-19 Auditoria B-011: DELETE /whatsapp/instance falha silenciosa

**Sintoma:** Operações de logout e delete ignoravam falhas silenciosamente, retornando sucesso mesmo quando a Evolution API estava inalcançável.

**Causa:** `except HTTPException: pass` suprimia erros sem log ou reporte.

**Solucao:** Erros agora são coletados em lista e reportados na resposta ("WhatsApp parcialmente desconectado. Erros: ...").

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `whatsapp`

### 2026-06-19 Auditoria B-012: Regex do journal frágil

**Sintoma:** Parser de logs usava regex vinculada a formato `short-iso` específico. Mudanças no systemd journal causavam logs vazios silenciosos.

**Causa:** Regex `_JOURNAL_RE` assumia formato fixo sem fallback.

**Solucao:** Alterado para `--output=json` com parser `_parse_journal_json()` que extrai timestamp, nível e mensagem de forma robusta usando campos estruturados do JSON.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `logs`

### 2026-06-19 Auditoria B-013: Sem pooling de conexão httpx

**Sintoma:** Cada chamada à Evolution API criava novo `httpx.AsyncClient`, desperdiçando handshakes TCP (~50-100ms por requisição).

**Causa:** `async with httpx.AsyncClient(timeout=30) as client:` era chamado dentro de `_evolution_proxy`.

**Solucao:** Implementado cliente HTTP compartilhado em nível de módulo com `_get_http_client()` e cleanup no `shutdown_event`.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `performance`

### 2026-06-19 Auditoria B-016: Sem rate limiting

**Sintoma:** Endpoint de transcrição aceitava requisições ilimitadas, permitindo DoS via exaustão de CPU/disco.

**Causa:** Nenhum mecanismo de rate limiting configurado.

**Solucao:** Adicionado `slowapi` com limite de 5 req/min no endpoint `/v1/audio/transcriptions`.

**Arquivos afetados:** `main.py`, `requirements.txt`

**Tags:** `backend` `api` `security`

### 2026-06-19 Auditoria F-005: Sem ErrorBoundary

**Sintoma:** Erros de renderização em qualquer componente deixavam a página completamente em branco.

**Causa:** Nenhum `ErrorBoundary` na árvore de componentes React.

**Solucao:** Criado `src/components/ErrorBoundary.tsx` com UI de fallback e botão de retry. Envolvido `App` no `main.tsx`.

**Arquivos afetados:** `src/components/ErrorBoundary.tsx`, `src/main.tsx`

**Tags:** `frontend` `error-handling`

### 2026-06-19 Auditoria S-002: CORS allow_credentials=True com allow_origins=["*"]

**Sintoma:** Configuração CORS inválida: `allow_credentials=True` com `allow_origins=["*"]` é rejeitada pela especificação CORS.

**Causa:** Configuração copiada de template sem consideração semântica.

**Solucao:** Alterado `allow_credentials=True` para `allow_credentials=False`.

**Arquivos afetados:** `main.py`

**Tags:** `backend` `api` `security`

### 2026-06-19 Auditoria I-004: requirements.txt não implantado

**Sintoma:** Adição de novas dependências Python ao `main.py` quebrava produção porque o CI/CD não instalava dependências.

**Causa:** Pipeline CI/CD só copiava `main.py` e `dist/`, sem etapa `pip install`.

**Solucao:** Criado `requirements.txt` com todas as dependências. Adicionado step de deploy do arquivo e instalação via `pip install -r` no CI/CD.

**Arquivos afetados:** `requirements.txt`, `.github/workflows/deploy.yml`

**Tags:** `backend` `ci-cd` `dependencies`

### 2026-06-20 Health check do deploy falha por timeout com --workers 2

**Sintoma:** Deploy automático (GitHub Actions) falha na etapa "Verify deployment (health check)" — o serviço reinicia via PM2 mas o `curl http://localhost:8000/health` não responde dentro de ~22s (5 tentativas × 3s + sleep). PM2 mostra o processo como `online` mas o endpoint não responde.

**Causa:** O modelo Whisper é carregado em nível de módulo (`main.py:247`, `WhisperModel(...)` chamado durante o `import`). Com `--workers 2` no uvicorn, cada worker importa `main.py` independentemente e bloqueia até o modelo terminar de carregar. O startup ultrapassou os ~20s do health check por contensão de recursos na VPS (modelo `medium` leva ~13s em condições normais; com 2 workers e pouca RAM, dobra o tempo).

Problemas adicionais do `--workers 2`:
- Cada worker carrega o modelo separadamente → dobra/quadruplica RAM (risco de OOM)
- `_audio_counter` é variável por processo → numeração duplicada nas transcrições do WhatsApp
- `ModelHandle` com `threading.Lock()` opera dentro de um processo, não entre processos — o controle de concorrência já era ineficaz com múltiplos workers

**Solucao:**
1. Criado `ecosystem.config.cjs` (versionado no repositório) sem `--workers` — worker único.
2. `deploy.yml` agora envia o ecosystem file para a VPS e recria o PM2 via `pm2 delete whisper-api && pm2 start ecosystem.config.cjs --update-env`.
3. Health check aumentado para 10 tentativas × 5s (total ~55s) como margem de segurança.
4. `deploy.sh` e `docs/main-vps.md` atualizados para refletir a nova config.
5. Adicionada documentação no `docs/main-vps.md` explicando por que não usar `--workers N`.

**Arquivos afetados:** `ecosystem.config.cjs` (novo), `.github/workflows/deploy.yml`, `deploy.sh`, `docs/main-vps.md`

**Tags:** `backend` `ci-cd` `deploy` `pm2` `workers`
