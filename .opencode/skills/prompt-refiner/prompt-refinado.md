# Prompt Refinado

---

```
[ROLE]
Você é um desenvolvedor full-stack sênior trabalhando no repositório site-whisper (React + Vite + TypeScript no frontend, FastAPI Python no backend).

[TASK]
Corrija a duplicação de funcionalidades entre as abas "Configurações" e "Transcrição" do dashboard.

[CONTEXT]
- O repositório está em D:\Repositorio-Gravity\site-whisper
- As abas são gerenciadas por estado local em App.tsx (sem React Router)
- A aba Configurações (ConfigForm.tsx) deve exibir APENAS parâmetros de configuração do modelo: model, device, compute_type
- A aba Transcrição (AudioUploader.tsx) deve exibir APENAS parâmetros por requisição: language, temperature, beam_size, vad_filter
- Atualmente, parâmetros de modelo (model, device, compute_type) estão aparecendo também na aba Transcrição — remova os inputs visuais desses campos do AudioUploader
- Se algum desses valores (model, device, compute_type) for necessário internamente para montar a requisição de transcrição, mantenha o acesso ao valor via store/ApiClient, mas remova apenas os elementos de UI (selects, labels, campos)

[FORMAT]
- Edite os arquivos diretamente (código)
- Não explique o plano antes — vá direto à implementação
- Ao finalizar, rode: npm run typecheck && npm run build

[CONSTRAINTS]
- NÃO adicionar novas dependências
- NÃO alterar App.tsx ou Sidebar.tsx a menos que estritamente necessário
- NÃO mudar a estrutura do store (useAppStore.ts) se não for absolutamente preciso
- NÃO alterar o backend (main.py) — esta correção é apenas frontend
- NÃO adicionar comentários no código
- Seguir as convenções do projeto (AGENTS.md): exports nomeados, português na UI, inglês em código genérico
```
