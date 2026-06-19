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
