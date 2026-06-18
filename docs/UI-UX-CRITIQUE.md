# UI/UX Critique — Whisper Control Dashboard

**Data**: 2026-06-17  
**Target**: `src/App.tsx` + todos os componentes  
**Register**: product  
**Score**: 24/40 (Acceptable)

---

## Design Health Score — Heurísticas de Nielsen

| # | Heurística | Nota | Issue-chave |
|---|-----------|------|-----------|
| 1 | Visibilidade do Status do Sistema | **3** | Toast e badge de status funcionam bem; falta progresso real na transcrição |
| 2 | Correspondência Sistema/Mundo Real | **3** | Labels em português claro; "beam_size" é técnico mas tem hint |
| 3 | Controle e Liberdade do Usuário | **2** | Sem botão cancelar transcrição em andamento; sem undo |
| 4 | Consistência e Padrões | **3** | Componentes consistentes; casing de labels uniforme entre Field e Slider |
| 5 | Prevenção de Erros | **2** | Valida extensão de arquivo; mas sem confirmação ao remover arquivo, sem validação de URL |
| 6 | Reconhecimento em vez de Memorização | **3** | Sidebar com ícones + labels; opções avançadas escondidas com progressive disclosure |
| 7 | Flexibilidade e Eficiência | **1** | Zero atalhos de teclado, sem batch, sem aceleradores para power user |
| 8 | Design Estético e Minimalista | **3** | Layout limpo e arejado; leve ghost-card pattern nos cards |
| 9 | Recuperação de Erros | **2** | Toast de erro claro; mas sem botão "tentar novamente" na transcrição falha |
| 10 | Ajuda e Documentação | **2** | Hints inline nos campos; sem FAQ, tour guiado, ou ajuda contextual além dos hints |
| **Total** | | **24/40** | **Acceptable** — base sólida, 3-4 melhorias estruturais necessárias |

### Escala

| Range | Rating |
|-------|--------|
| 36–40 | Excellent — minor polish only |
| 28–35 | Good — address weak areas |
| **20–27** | **Acceptable — significant improvements needed** |
| 12–19 | Poor — major UX overhaul |
| 0–11 | Critical — redesign needed |

---

## Anti-Patterns Verdict

**Deterministic scan** (`detect.mjs --json src`): Encontrou 1 resultado — uso de **Inter** como fonte (`src/index.css:13`). No contexto de produto (product register), Inter é uma **permissão explícita** ("System fonts and familiar sans defaults"). **Falso positivo**.

**Avaliação manual**: O projeto escapa da maioria dos tells de AI slop. Não há gradientes em texto, glassmorphism decorativo, hero metrics, grid de cards idênticos, nem side-stripe borders. A paleta azul (`#1c7ef5`) é funcional e bem distribuída.

**Violação encontrada**: O componente `Card` (`src/components/ui/Card.tsx:36-37`) aplica `border border-slate-200` + `shadow-card` (blur 24px) no mesmo elemento — o **ghost-card pattern**, banido pelas regras absolutas. Borda + sombra com blur ≥ 16px no mesmo elemento nunca é intencional.

---

## Overall Impression

O dashboard está **funcional e bem estruturado** para um MVP técnico. A arquitetura de componentes é limpa (Button, Card, Badge, Field, Select, Slider, Toaster formam um mini design system coeso) e o fluxo principal (upload → transcrever → copiar) funciona bem.

O maior gap é a **ausência de controles de cancelamento e recuperação de erros** — o operador fica preso esperando uma transcrição longa sem poder abortar. O segundo gap é a **falta total de atalhos para power users**, que é o persona-alvo declarado (dev/ops solo). Fora isso, é uma base sólida que precisa de endurecimento (harden) e polimento (polish), não de redesign.

---

## What's Working

1. **Sistema de feedback imediato** — Toasts com ícones por tipo (success/error/info), Badge com dot pulsante para status online/offline/connecting, spinners nos botões durante ações assíncronas, e auto-check de conexão a cada 30 segundos. O operador sempre sabe o estado do sistema.

2. **Arquitetura de componentes reutilizáveis** — `Button` (4 variants, 3 sizes, loading state), `Card` (header com icon/title/actions), `Badge` (5 tones, dot + pulse), `Field` (label + hint + error), `Select` (chevron customizado), `Slider` (track com gradiente). Todos bem tipados com TypeScript e usando `cn()` para composição de classes.

3. **Sidebar mobile-responsive** — Slide-out com overlay `backdrop-blur-sm`, transição `duration-300`, hamburger menu com toggle X/Menu, e `-translate-x-full` / `translate-x-0` condicional. Boa UX mobile.

4. **Progressive disclosure nos parâmetros de IA** — Opções avançadas (idioma, beam size, temperatura, VAD filter) escondidas atrás de toggle "Opções da IA" / "Ocultar opções", com hints explicativos em cada campo. Reduz carga cognitiva no fluxo principal.

5. **Boas práticas de código** — Componentes com JSDoc, store Zustand limpo, ApiClient como singleton com interceptors de log, types compartilhados com constantes (`LANGUAGES`, `MODELS`, `DEVICES`, `COMPUTE_TYPES`).

---

## Priority Issues

### [P1] Transcrição sem cancelamento — usuário fica preso

- **Local**: `src/components/AudioUploader.tsx:121-144` (função `handleTranscribe`) + `src/components/ui/Button.tsx:67` (spinner substitui leftIcon)
- **Impacto**: O operador clica "Processar áudio" e o botão mostra spinner. Não há como abortar. Se o áudio for longo (10+ minutos) e o modelo lento, o usuário fica travado sem saída — a única opção é recarregar a página e perder o arquivo.
- **Fix**: Adicionar `AbortController` no escopo do componente; passar `signal` para a request axios; trocar o botão para "Cancelar" com ícone X durante o processamento; ao cancelar, manter o arquivo selecionado para retentativa.
- **WCAG/Standard**: Nielsen #3 (User Control and Freedom) — "Users need a clear emergency exit"
- **Suggested command**: `$impeccable harden AudioUploader`

### [P1] Zero aceleradores para power user

- **Local**: `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/AudioUploader.tsx`
- **Impacto**: O persona declarado no docs/PRODUCT.md é dev/ops solo fazendo uploads frequentes. Sem atalhos de teclado (Ctrl+Enter para processar, 1/2 para trocar seção, Esc para fechar sidebar mobile), cada ação exige mouse. Em uso repetitivo, isso gera fadiga e frustração.
- **Fix**: Adicionar `useEffect` com listener de `keydown` global: teclas `1`/`2` para navegação entre seções, `Ctrl+Enter` para ação principal, `Esc` para dismiss (sidebar, toasts, modal). Documentar atalhos via tooltip ou footer sutil.
- **WCAG/Standard**: Nielsen #7 (Flexibility and Efficiency) — "Accelerators, invisible to novices, speed up expert interaction"
- **Suggested command**: `$impeccable harden Sidebar` + `$impeccable harden AudioUploader`

### [P2] Ghost-card pattern no componente Card

- **Local**: `src/components/ui/Card.tsx:36-37`
- **Impacto**: Violação do ban absoluto "border + shadow com blur ≥ 16px no mesmo elemento". O cartão flutua artificialmente (`shadow-card` com blur 24px + `border border-slate-200`) em vez de pertencer à superfície. Passa sensação de fragilidade visual.
- **Fix**: Escolher um caminho: (a) remover `shadow-card` e usar apenas `border` com cor mais presente (`border-slate-200/80`), ou (b) remover a borda e usar apenas sombra para elevação. Para o contexto de dashboard com `bg-slate-50`, a opção (a) é mais coerente com o visual limpo.
- **Suggested command**: `$impeccable polish Card`

### [P2] Sem retry em transcrição falha

- **Local**: `src/components/AudioUploader.tsx:139` (catch do `handleTranscribe`)
- **Impacto**: Se a transcrição falhar (erro de rede, timeout de 120s), o usuário vê um toast de erro mas o arquivo some da interface. Precisa re-selecionar o arquivo, reconfigurar opções, e clicar processar de novo. Quebra de fluxo desnecessária.
- **Fix**: Não limpar `state` (arquivo) no catch — apenas no `finally` se sucesso. Exibir banner de erro inline abaixo do preview do arquivo com botão "Tentar novamente". Preservar `opts` entre tentativas.
- **WCAG/Standard**: Nielsen #9 (Error Recovery) — "Help users recognize, diagnose, and recover from errors"
- **Suggested command**: `$impeccable harden AudioUploader`

### [P2] Dois componentes construídos mas não renderizados

- **Local**: `src/App.tsx:31-41` — `ConfigForm` e `LogViewer` são importados mas nunca renderizados condicionalmente
- **Impacto**: Duas features completas existem no código mas estão inacessíveis ao usuário:
  - `ConfigForm` (213 linhas): configuração do modelo Whisper (modelo, device, compute type, idioma padrão, beam size, temperatura, VAD filter, save/reset)
  - `LogViewer` (176 linhas): visualizador de logs do servidor estilo terminal com filtro, play/pause, auto-scroll, color-coding por nível
  O dashboard atual tem apenas 2 das 4 seções disponíveis. O operador não tem acesso à configuração do modelo nem aos logs do servidor.
- **Fix**: Adicionar `'config'` e `'logs'` ao tipo `SectionId`. Criar entradas no array `NAV_ITEMS` com ícones apropriados. Renderizar `ConfigForm` e `LogViewer` condicionalmente no `App.tsx` baseado no `active` state.
- **Suggested command**: `$impeccable craft config-and-logs`

### [P3] Campo de URL sem `<label>` associado

- **Local**: `src/components/StatusCard.tsx:43-49`
- **Impacto**: O input de URL da API não tem elemento `<label>` — apenas `placeholder="http://<ip-vps>:8000"`. Leitores de tela não anunciam o propósito do campo. Usuários de keyboard-only não têm indicação clara do que preencher.
- **Fix**: Envolver o input com o componente `Field` já existente no projeto (`label="URL da API"`, `hint="Endereço do servidor Faster-Whisper"`, `htmlFor` com id único). Ou adicionar `aria-label="URL da API"` como alternativa mínima.
- **WCAG/Standard**: WCAG 2.1 AA — 3.3.2 Labels or Instructions
- **Suggested command**: `$impeccable clarify StatusCard`

### [P3] Sidebar hamburger com aria-label estático

- **Local**: `src/components/Sidebar.tsx:44`
- **Impacto**: `aria-label="Abrir menu"` é hardcoded. Quando o menu está aberto, o leitor de tela ainda anuncia "Abrir menu", o que é confuso — o usuário pode achar que o menu está fechado e tentar abri-lo de novo.
- **Fix**: `aria-label={open ? 'Fechar menu' : 'Abrir menu'}`. Uma linha, sem impacto visual.
- **WCAG/Standard**: WCAG 2.1 AA — 4.1.2 Name, Role, Value
- **Suggested command**: `$impeccable clarify Sidebar`

### [P3] Health check usa `/docs` em vez de endpoint dedicado

- **Local**: `src/services/api.ts:85` — `await this.instance.get('/docs', { timeout: 8_000 })`
- **Impacto**: O health check depende da página de documentação do FastAPI (`/docs`). Se o Swagger UI for desabilitado em produção (comum por segurança), o dashboard reporta "offline" mesmo com a API funcionando. Falso negativo que corrói a confiança no dashboard.
- **Fix**: Alterar para `await this.instance.get('/health', { timeout: 8_000 })` ou `/status` — endpoints dedicados que o backend já pode ter ou deve expor. Como fallback, usar `/v1/audio/transcriptions` com HEAD.
- **Suggested command**: `$impeccable harden ApiClient`

---

## Cognitive Load Assessment

| Item | Status |
|------|--------|
| Single focus — usuário completa tarefa principal sem distração | Pass |
| Chunking — informação em grupos digeríveis (≤4 por grupo) | Pass |
| Grouping — itens relacionados agrupados visualmente | Pass |
| Visual hierarchy — claro o que é mais importante na tela | Pass |
| One thing at a time — uma decisão por vez | Pass |
| Minimal choices — ≤4 opções visíveis por decisão | Pass (opções avançadas colapsadas) |
| Working memory — sem necessidade de lembrar info de tela anterior | Pass |
| Progressive disclosure — complexidade revelada sob demanda | Pass |

**Resultado**: 0 falhas — baixa carga cognitiva. O fluxo é bem estruturado para o operador.

---

## Persona Red Flags

### Alex (Power User — dev/ops solo)

- Nenhum atalho de teclado disponível. Sidebar requer clique do mouse. Processar áudio requer mouse.
- Não é possível arrastar múltiplos arquivos para fila de transcrição — um por vez.
- Check de conexão é automático (bom), mas sem indicador de latência ou uptime visível.
- Alta probabilidade de frustração após o 5º upload manual repetitivo sem atalhos.

### Jordan (First-Timer — novo operador)

- O termo "beam_size" (mesmo com hint) pode intimidar quem nunca usou Whisper.
- Empty state do uploader é apenas o drop zone — sem exemplo de formato, sem CTA alternativo.
- Quando a API está offline, o botão "Processar áudio" apenas desabilita sem explicar o porquê.
- Sem indicação do que fazer se o upload falhar ou demorar.

### Sam (Acessibilidade — leitor de tela / keyboard-only)

- Campo de URL da API (`StatusCard.tsx:43`) sem `<label>` — apenas placeholder.
- Drop zone (`AudioUploader.tsx:164`) com `role="button"` e `tabIndex={0}` mas sem `aria-label` descrevendo a ação.
- VAD Filter checkbox (`AudioUploader.tsx:315`) — label wrapper sem `htmlFor`, ordem de leitura não ideal.
- Sidebar hamburger (`Sidebar.tsx:44`) — `aria-label` não atualiza entre estados aberto/fechado.
- Focus rings presentes (bom) — `focus:ring-2 focus:ring-brand-400` consistente nos inputs e botões.

---

## Minor Observations

- `src/App.tsx:24` — `pt-10 lg:pt-0` no header é um workaround para não colidir com o hamburger menu mobile. Melhor: posicionar o hamburger fora do fluxo do `<main>` ou usar `padding-top` condicional baseado em media query no próprio CSS.
- `src/components/AudioUploader.tsx:199-200` — o texto do drop zone tem repetição: "Arraste e solte o áudio **aqui** / ou **clique para selecionar**". A segunda parte não tem objeto — seria "ou clique para selecionar um arquivo".
- `src/components/ui/Toaster.tsx:22-24` — `useEffect` vazio (`/* nada além de delegar ao store */`). Desnecessário, pode remover.
- `src/components/Card.tsx:37` — `hover:shadow-lg` no card. Cards de dashboard não deveriam ter hover de elevação (sugere interatividade onde não há). Se o card não é clicável, não deve reagir a hover.

---

## Questões em Aberto

- Com `ConfigForm` e `LogViewer` já prontos (377 linhas de código combinadas) e não renderizados, o escopo real do produto é maior do que o entregue. Vale a pena ativar essas seções agora ou foram deixadas de fora intencionalmente?
- O fluxo de transcrição atual é single-file. Para um dev/ops processando múltiplos áudios, uma fila de upload com processamento em lote seria mais eficiente que um arquivo por vez?
- O check de conexão usa `/docs` como health endpoint. Isso é intencional ou seria melhor migrar para um endpoint dedicado (`/health` ou `/status`)?

---

## Recommended Actions (em ordem de prioridade)

| # | Pri | Comando | Escopo |
|---|-----|---------|--------|
| 1 | P1 | `$impeccable harden AudioUploader` | Cancelamento de transcrição, retry em falha, preservação de estado |
| 2 | P1 | `$impeccable harden Sidebar` | Atalhos de teclado (1/2, Ctrl+Enter, Esc) |
| 3 | P2 | `$impeccable polish Card` | Resolver ghost-card pattern (border + shadow blur ≥16px) |
| 4 | P2 | `$impeccable craft config-and-logs` | Ativar ConfigForm e LogViewer como seções navegáveis |
| 5 | P2 | `$impeccable harden ApiClient` | Migrar health check de `/docs` para endpoint dedicado |
| 6 | P3 | `$impeccable clarify StatusCard` | Adicionar `<label>` ao input de URL |
| 7 | P3 | `$impeccable clarify Sidebar` | Corrigir aria-label dinâmico no hamburger |
| 8 | — | `$impeccable document` | Gerar docs/DESIGN.md a partir dos tokens visuais existentes |
| 9 | Final | `$impeccable polish` | Passada final de qualidade em todos os componentes ajustados |

**Projeção pós-correções P1+P2**: 30-32/40 (Good).

---

## Run Notes

- **Assessment independence**: Degradado — avaliações A e B executadas sequencialmente (sem suporte a sub-agentes neste ambiente).
- **CLI detector**: `detect.mjs --json src` retornou 1 finding (Inter font — falso positivo para product register).
- **Browser visualization**: Não disponível — sem automação de browser.
- **Snapshot**: Não persistido — diretório `.impeccable/critique/` não configurado localmente.

---

*Relatório gerado via impeccable critique flow. Re-execute `$impeccable critique` após as correções para ver a evolução do score.*
