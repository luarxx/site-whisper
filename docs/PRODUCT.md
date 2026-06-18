# Product

## Register

product

## Users

Um operador técnico (dev/ops) gerencia sozinho o serviço de transcrição Faster-Whisper. Contexto: monitoramento de API, upload de áudio, configuração de modelos, leitura de logs. Tarefa principal por tela: verificar status da conexão ou transcrever um áudio.

## Product Purpose

Dashboard para gerenciar uma API Faster-Whisper self-hosted. O produto existe para dar visibilidade e controle sobre o serviço de transcrição — testar conexão, enviar áudios, ajustar parâmetros do modelo e acompanhar logs do servidor — sem precisar acessar o terminal.

## Brand Personality

Técnica, confiável, minimalista. Voz direta e funcional, sem firulas. O design inspira confiança de que o serviço está operacional e preciso.

## Anti-references

- Nada de dashboard enterprise denso e sobrecarregado (estilo Grafana/Datadog com dezenas de métricas)
- Nada de landing page marketing com hero sections, gradientes chamativos ou copy BuzzFeed
- Nada de glassmorphism decorativo, ilustrações sketchy, ou bordas laterais coloridas
- Sem dark mode forçado "porque ferramenta é dark"

## Design Principles

1. **Clareza acima de decoração** — Cada elemento na tela tem função. Status é visível instantaneamente.
2. **Confiança via precisão** — Feedback imediato em cada ação (conexão testada, upload concluído, transcrição pronta).
3. **Foco em uma tarefa por vez** — O layout guia o operador para a ação principal sem distrações.
4. **Leveza visual** — Interface arejada que não cansa em uso prolongado. Tipografia nítida, espaçamento generoso.

## Accessibility & Inclusion

- WCAG 2.1 AA (contraste mínimo 4.5:1 para texto, 3:1 para elementos grandes)
- Respeitar `prefers-reduced-motion` em todas as animações
- Suporte a navegação por teclado (focus rings visíveis)
- Labels claros em campos de formulário
