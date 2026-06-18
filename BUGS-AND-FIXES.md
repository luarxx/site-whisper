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

<!-- Adicione entradas abaixo desta linha conforme bugs forem encontrados e resolvidos -->

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
