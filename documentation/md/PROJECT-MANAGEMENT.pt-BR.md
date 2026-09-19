# Gerenciamento de Projetos

## Backlog e gerenciamento de projetos

<https://linear.app/jumentix>

O Linear é a fonte única da verdade para gerenciamento de projetos, épicos e rastreamento de tarefas (Requisito `095`). Ele também deve identificar o `agent_identifier` ativo de cada Issue e Project/Epic executável, sincronizado com o Agent Registry canônico (Requisito `120`).

Agentes devem refrescar progresso, bloqueios, branches, PRs e Project Updates de agentes irmãos antes de iniciar ou retomar trabalho no mesmo épico, milestone ou componente (Requisito `121`).

## Requisitos internos e rastreamento de MVP

- Requisitos técnicos e agentes especializados:
  - `.agents/README.md`
  - `.agents/AGENT-REGISTRY.md`
  - `AGENTS.md` (Codex)
  - `CLAUDE.md` (Claude Code)
  - `GROK.md` (Grok)
  - `OPENCODE.md` (OpenCode)
- Autoridade oficial de planejamento:
  - `https://linear.app/jumentix`
  - chave da API do Linear em `../.linear` (acesso controlado, nunca commitar ou compartilhar)
- Referência de governança:
  - `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
- Roadmap MVP do Domain Designer:
  - `documentation/md/DOMAIN-DESIGNER-MVP-ROADMAP.md`
