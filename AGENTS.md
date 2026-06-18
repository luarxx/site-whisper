# AGENTS.md - Project Instructions

## Project

Dashboard React + Vite para gerenciar uma API Faster-Whisper self-hosted. Exibe status da conexao, configuracao do modelo, upload de audio para transcricao e terminal de logs. O backend Python (FastAPI, `main.py` na raiz) e o frontend (build `dist/`) sao deployados juntos na mesma VPS — o FastAPI serve estaticos via `StaticFiles`, dispensando nginx/proxy adicional.

Stack principal: Vite 5, React 18, TypeScript (strict), Tailwind CSS 3, Zustand (com `persist`), Axios, Lucide React, `clsx` + `tailwind-merge`.

Projeto ESM (`"type": "module"` no `package.json`). Alias de import `@/*` -> `src/*` configurado em `tsconfig.app.json`.

Nao adicionar roteador (React Router, etc.) — o app tem 4 secoes via estado local em `App.tsx`. Nao adicionar framework de UI (MUI, Chakra, Mantine). Nao adicionar state manager alternativo (Redux, Jotai). Nao substituir Vite por outro bundler.

O backend Python (`main.py`, FastAPI) vive NESTE repositorio (na raiz) e e o que vai para o deploy na VPS — o arquivo e copiado para `~/whisper-api/main.py` em `SEU_IP`, junto com o build do frontend (`dist/`) copiado para `~/whisper-api/static/`. O FastAPI serve estaticos via `StaticFiles`. Ver `docs/comandos-vps.md` para operacao do servico na VPS e `docs/main-vps.md` para setup, contrato e historico do backend.

---

## Context Economy

Antes de abrir arquivos grandes, use `rg` (ou `grep`) para localizar simbolos, componentes, hooks, tipos ou utilitarios relevantes.

Leia apenas os arquivos necessarios para a tarefa atual.

Nao investigar `node_modules/`, `dist/`, `tsconfig.*.tsbuildinfo` ou caches, salvo se a tarefa envolver build, tipos ou artefatos gerados.

Nao abrir `docs/comandos-vps.md` ou `docs/main-vps.md` salvo quando a tarefa envolver deploy, VPS, systemd ou `main.py` do backend.

Leia `docs/DESIGN.md` apenas para tarefas de UI/UX, layout, copy visual, cores, animacoes, responsividade ou acessibilidade.

Leia `docs/UI-UX-CRITIQUE.md` apenas para revisao visual, polimento ou auditoria de design.

Logs temporarios `.vite-dev.log`, `.vite-dev.err`, `.vite-dev.log.err` sao ruido de desenvolvimento — ignore salvo quando a tarefa envolver debug do Vite.

---

## Code Map

- `src/main.tsx`: entry point; monta `<App />` no `#root`.
- `src/App.tsx`: shell da aplicacao, roteamento por secao (`status` | `transcribe` | `config` | `logs`), hotkeys 1-4, polling de conexao a cada 30s.
- `src/index.css`: tokens Tailwind, keyframes (`pulse-soft`, `fade-in`, `blink`), scrollbar.
- `src/services/api.ts`: `ApiClient` (wrapper Axios) com `health`, `transcribe`, `getConfig`, `saveConfig`, `getLogs`; exporta `getApiClient()` (singleton).
- `src/store/useAppStore.ts`: estado global Zustand (apiBaseUrl, isOnline, transcription, config, logs, toasts) e todas as acoes.
- `src/types/index.ts`: contratos TS (`WhisperConfig`, `ApiStatus`, `LogLine`, `TranscribeResponse`, `ApiError`) e enums (`WhisperModel`, `Device`, `ComputeType`, `LanguageCode`) + listas (`LANGUAGES`, `MODELS`, `DEVICES`, `COMPUTE_TYPES`).
- `src/components/Sidebar.tsx`: navegacao lateral, secao ativa, hamburger mobile.
- `src/components/StatusCard.tsx`: badge online/offline, latencia, uptime, recursos (CPU/GPU/RAM) e edicao da URL base da API.
- `src/components/AudioUploader.tsx`: drop zone, envio do arquivo para `/transcribe`, exibicao e copia do resultado.
- `src/components/ConfigForm.tsx`: formulario de `WhisperConfig` (model, device, compute_type, language, temperature, beam_size, vad_filter).
- `src/components/LogViewer.tsx`: terminal com auto-refresh, filtro, autoscroll, pausa e botao limpar.
- `src/components/ui/`: primitives reutilizaveis (`Badge`, `Button`, `Card`, `Field`, `Select`, `Slider`, `Toaster`).
- `src/utils/index.ts`: `cn()` (clsx + tailwind-merge), `formatUptime()`, `formatBytes()` e demais helpers.
- `main.py`: backend FastAPI (`/health`, `/status`, `/config`, `/v1/audio/transcriptions`, `/logs`) que vai para o deploy na VPS. Toda alteracao de comportamento do backend acontece aqui. Tambem serve o frontend estatico via `StaticFiles` a partir de `static/`.
- `vite.config.ts`: plugins Vite (React, DOM Inspector via `vite-plugin-dom-inspector`).
- `tailwind.config.js`: tema customizado (`brand`, `surface`, `shadow-soft`, `shadow-card`, `shadow-glow`).
- `.env.production`: variaveis de build de producao (`VITE_API_BASE_URL=""` para chamadas same-origin).
- `deploy.sh`: script de deploy manual (build, rsync frontend + backend, restart systemd).
- `.github/workflows/deploy.yml`: CI/CD — deploy automatico no push para `main`.

Documentacao auxiliar:
- `README.md`: instalacao, scripts, contrato esperado da API.
- `docs/PRODUCT.md`: proposito, usuarios, principios de design, acessibilidade.
- `docs/DESIGN.md`: design system completo (cores, tipografia, spacing, sombras, animacoes, tokens por componente).
- `docs/UI-UX-CRITIQUE.md`: auditoria visual e sugestoes de polimento.
- `docs/comandos-vps.md`: operacao do servico Whisper na VPS (systemd, logs, debug).
- `docs/main-vps.md`: setup do `main.py` (FastAPI) na VPS.
- `deploy.sh`: script de deploy manual (build frontend + rsync + restart systemd).

---

## Scope Routing

UI / componente visual:
- Priorize `src/components/` e `src/components/ui/`.
- Verifique `docs/DESIGN.md` para tokens, estados e variantes.
- Nao tocar no store ou services sem necessidade.

Estado global:
- Priorize `src/store/useAppStore.ts`.
- Se a acao envolver fetch, prefira chamar `ApiClient` direto no store e refletir em `set(...)`.

Integracao com a API:
- Priorize `src/services/api.ts` e `src/types/index.ts`.
- Mapeie endpoint FastAPI -> metodo do `ApiClient` -> acao do store -> componente consumidor.

Tipos / contrato:
- Priorize `src/types/index.ts`.
- Se adicionar tipo do backend, mantenha sincronizado com `README.md` (secao "Contrato esperado da API").

Shell / navegacao:
- Priorize `src/App.tsx` e `src/components/Sidebar.tsx`.
- Hotkeys 1-4 estao centralizadas em `App.tsx`; nao duplicar atalhos nos componentes.

Utilitarios:
- Adicione helpers em `src/utils/index.ts` quando forem reutilizados por 2+ componentes.

---

## Documentation Routing

Leia documentacao auxiliar apenas quando a tarefa exigir:

- Setup/instalacao/contrato da API: `README.md`
- Proposito, usuarios, anti-referencias, acessibilidade: `docs/PRODUCT.md`
- Design system, tokens, componentes, layout, breakpoints, animacoes: `docs/DESIGN.md`
- Auditoria visual e polimento: `docs/UI-UX-CRITIQUE.md`
- Operacao na VPS (systemd, journal, debug): `docs/comandos-vps.md`
- Setup do backend `main.py`: `docs/main-vps.md`
- Deploy (manual): `deploy.sh`
- Deploy (CI/CD): `.github/workflows/deploy.yml`
- Configuracao Vite/TS: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`

Documentacao auxiliar em `docs/`. Nao ha testes automatizados configurados (`package.json` nao define `test`).

---

## Feature Routing

Para Status & Monitoramento:
- Frontend: `StatusCard`, polling de 30s em `App.tsx`.
- Store: `checkConnection`, `isOnline`, `isConnecting`, `apiBaseUrl`.
- Service: `ApiClient.health()` (tenta `/health` e cai em `/docs`).
- Endpoints: `GET /status` (opcional) + `GET /health` ou `GET /docs` como health check.
- Edicao da URL base da API e persistencia: `useAppStore.setApiBaseUrl` + middleware `persist` do Zustand.

Para Configuracao do Modelo:
- Frontend: `ConfigForm`.
- Store: `refreshConfig`, `updateConfigDraft`, `saveConfig`, `config`, `configDraft`.
- Service: `ApiClient.getConfig()`, `ApiClient.saveConfig()`.
- Endpoints: `GET /config`, `POST /config`.
- Constantes (listas de modelos, devices, compute types, languages): `src/types/index.ts` (`MODELS`, `DEVICES`, `COMPUTE_TYPES`, `LANGUAGES`).

Para Transcricao Rapida:
- Frontend: `AudioUploader` (drag-and-drop, botao processar, copiar resultado).
- Store: `setTranscription`, `setTranscribing`, `transcription`, `isTranscribing`.
- Service: `ApiClient.transcribe(file, options)` — multipart, `timeout: 0`, suporta `AbortSignal`.
- Endpoint: `POST /transcribe` (multipart/form-data com `file`, `language`, `temperature`, `response_format`, `beam_size`, `vad_filter`).
- Tipos de audio aceitos (cliente): mp3, wav, m4a, ogg, flac — validar no `AudioUploader`.

Para Terminal de Logs:
- Frontend: `LogViewer` (auto-refresh, filtro por nivel, autoscroll, pausa, limpar).
- Store: `refreshLogs`, `logs`, `isLoadingLogs`.
- Service: `ApiClient.getLogs(limit = 200)`.
- Endpoint: `GET /logs?limit=200` retornando `{ lines: LogLine[], total: number }`.

Para Toasts / notificacoes:
- Frontend: `Toaster` (componente) + hotkey `Esc` em `App.tsx`.
- Store: `pushToast`, `dismissToast`, `toasts`. Auto-dismiss em 4500ms.
- Tons suportados: `success` | `error` | `info` (mapeados em `Badge`/`Toaster`).

Para URL base da API:
- Editada em `StatusCard`, definida por `VITE_API_BASE_URL` em build time.
- Persistida em runtime via `persist` do Zustand (`localStorage`).
- Singleton do `ApiClient` reconfigurado em `setApiBaseUrl`.

---

## Critical Rules

- TypeScript strict (`strict: true` em `tsconfig.app.json`); respeitar tambem `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `noImplicitOverride`.
- Preferir exports nomeados.
- Portugues para UI e dominio: "Conexao & Status", "Transcricao", "Configuracoes", "Logs", nomes de variaveis visiveis ao usuario.
- Ingles para codigo generico: tipos, hooks, utilitarios, acoes do store, chaves internas.
- Nao usar comentarios em linha no codigo-fonte salvo real necessidade. JSDoc curto e permitido em funcoes publicas do `ApiClient` e do store.
- Nao introduzir nova dependencia sem justificativa; preferir primitives em `src/components/ui/`.
- Manter `ApiClient` como singleton via `getApiClient()`; nao instanciar Axios em componentes.
- Toda chamada HTTP passa por `ApiClient`; nenhum componente importa `axios` diretamente.
- Tipos compartilhados ficam em `src/types/index.ts`; nao duplicar contratos inline.
- `App.tsx` mantem a logica de roteamento por estado local e hotkeys 1-4; nao adicionar React Router.
- Polling de conexao em `App.tsx` usa intervalo de 30s; ajustar apenas se a tarefa exigir.
- Auto-dismiss de toasts em 4500ms em `useAppStore.pushToast`; manter consistencia.
- `VITE_API_BASE_URL` e a unica env esperada; `.env.production` define o valor de producao (`""` para same-origin), `.env.example` referencia o mesmo nome.
- Logs de runtime usam prefixo curto, por exemplo `[API]`, `[Store]`, `[Toaster]`, `[ConfigForm]`, `[AudioUploader]`, `[LogViewer]` — manter o padrao ja existente.
- O backend Python (`main.py`, FastAPI) vive NESTE repositorio (na raiz). **TODA modificacao que precise ir para a VPS DEVE alterar `main.py` aqui, pois este arquivo e o que vai para o deploy** (copia para `~/whisper-api/main.py` na VPS, conforme `docs/main-vps.md` e `docs/comandos-vps.md`). O frontend (build `dist/`) e copiado para `~/whisper-api/static/` e servido via `StaticFiles` pelo mesmo FastAPI.
- Frontend (`src/`) e backend (`main.py`) compartilham contrato de API. Qualquer mudanca em endpoint, payload, header, formato de erro ou log precisa ser refletida nos dois lados — e a parte do backend sempre em `main.py`, no commit deste repositorio.
- Documentacao auxiliar centralizada em `docs/`. Nao criar `server/`, `scraper/` ou `tests/`.
- Documentacao viva: atualizar `AGENTS.md`, `README.md`, `docs/DESIGN.md`, `docs/UI-UX-CRITIQUE.md` ou `docs/PRODUCT.md` quando mudar stack, contratos, comandos ou design system.
- Emojis decorativos em `console.*` ja existem no codigo (`➡️`, `✅`, `❌`); manter consistência ao adicionar novos logs. Nao usar emojis em UI fora dos tons ja mapeados (`Toaster`).
- **`.gitignore` hygiene:** ao criar arquivo com conteudo sensivel (credenciais, tokens, chaves) ou artefato gerado que nao deve ir para o repositorio (caches, logs, build artifacts), atualizar o `.gitignore` no mesmo PR/commit. Revisar periodicamente se `node_modules/`, `dist/`, `*.tsbuildinfo`, `*.log`, `.env` estao cobertos.

---

## Testing and Validation

Rode validacoes proporcionais ao escopo.

Frontend:
- `npm run typecheck` apos qualquer alteracao em TypeScript.
- `npm run build` apos qualquer mudanca em `src/`. O script ja executa `tsc -b && vite build`.
- `npm run lint` (alias para `tsc -b --noEmit`) — util antes de commit.

Backend / VPS:
- `main.py` (raiz) e o backend FastAPI. Para rodar localmente: criar venv, `pip install fastapi uvicorn faster-whisper psutil python-multipart` (ou usar `requirements.txt` se existir), `python main.py` ou `uvicorn main:app --host 0.0.0.0 --port 8000`.
- Para testar na VPS: seguir `docs/comandos-vps.md` (curl em `/health`, `/v1/audio/transcriptions`, `/logs`).
- Apos QUALQUER alteracao em `main.py`, rebuild do servico: `sudo systemctl restart whisper` (ver `docs/comandos-vps.md`).

Docs-only:
- Nao rodar build/testes salvo se solicitado.

Testes automatizados:
- Nao ha suite de testes configurada. Se uma suite for adicionada no futuro, preferir Vitest (padrao da comunidade Vite/React). Ate la, validar manualmente abrindo o app e exercitando o fluxo afetado.

---

## Aprendizado com bugs

Ao corrigir qualquer bug, adicione uma entrada em `BUGS-AND-FIXES.md` (seguindo o template e instrucoes do proprio arquivo). O arquivo e carregado automaticamente via `opencode.json` → `instructions`. Isso permite que o modelo aprenda com erros passados e evite repeti-los em sessoes futuras.

---

## Response Rules

Antes de editar, explique brevemente o plano.

Ao finalizar, diga:
- arquivos criados;
- arquivos alterados;
- validacoes executadas;
- qualquer validacao nao executada e o motivo.
