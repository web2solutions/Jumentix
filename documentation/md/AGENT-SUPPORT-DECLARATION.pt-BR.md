<!--
Arquivo gerado automaticamente a partir de: documentation/md/AGENT-SUPPORT-DECLARATION.md
Idioma alvo: Português (Brasil)
-->
# Declaração de Agentes Suportados

Mecanismo canônico adicionado em 2026-08-05 sob a issue do Linear
[JUM-604](https://linear.app/jumentix/issue/JUM-604) e o Requisito `125`.

## O que significa suportar um agente

Um agente de engenharia é suportado por este repositório quando todos os itens a seguir são
verdadeiros:

1. Possui uma entrada em `.agents/supported-agents.json` com `platformId`, `branchPrefix`,
   `displayName` e `instructionsFile`.
2. Seu arquivo de instruções na raiz (por exemplo `KIMI.md`) existe e segue o padrão de regras
   de trabalho compartilhado por `AGENTS.md`, `CLAUDE.md`, `GROK.md` e `OPENCODE.md`.
3. Está registrado no registro canônico de agentes no Firestore (Requisito `089`) via
   `bun run agent-registry:register`.
4. Commita com uma identidade autorizada em `.agents/AUTHORIZED-COMMITTERS.json`
   (Requisito `111`).
5. Suas branches de tarefa usam o `branchPrefix` declarado no formato
   `<prefix>/<nature>/<issue-id>-<short-slug>` (Requisito `122`).

## Arquivo de declaração

`.agents/supported-agents.json` é o conjunto declarado e único de agentes suportados:

```json
[
  {
    "platformId": "kimi",
    "branchPrefix": "kimi",
    "displayName": "Kimi Code CLI",
    "instructionsFile": "KIMI.md"
  }
]
```

O `ci-cd/check-pr-governance.js` deriva os prefixos de branch de tarefa aceitos a partir deste
arquivo — tanto para o formato estrito `agent/nature/JUM-NNN-slug` quanto para o formato legado
`agent/nature/slug` — e falha de forma fechada com um diagnóstico claro quando a declaração está
ausente ou malformada. O mesmo gate (`bun run pr:governance:check`, integrado ao CI) também
verifica se o `instructionsFile` de cada agente declarado existe, de modo que uma declaração
apontando para nada falha o gate.

## Adicionando um novo agente

Adicionar o próximo agente é uma mudança de dados, não de código:

1. Registre o agente no Firestore (`bun run agent-registry:register`) e autorize sua identidade
   de commit (Requisito `111`).
2. Adicione o arquivo de instruções da plataforma na raiz, espelhando as regras de trabalho
   existentes.
3. Adicione uma entrada em `.agents/supported-agents.json`.
4. Execute `bun run pr:governance:check` e `bun run requirements:check` para confirmar que os
   gates permanecem verdes.

Nenhuma alteração em `ci-cd/check-pr-governance.js` é necessária.

## Plataformas atualmente declaradas

| Plataforma | Prefixo de branch | Arquivo de instruções |
| --- | --- | --- |
| Codex | `codex` | `AGENTS.md` |
| Claude Code | `claude` | `CLAUDE.md` |
| Grok | `grok` | `GROK.md` |
| OpenCode | `opencode` | `OPENCODE.md` |
| Kimi Code CLI | `kimi` | `KIMI.md` |

## Requisitos relacionados

- `077` Suporte a múltiplas plataformas de agentes
- `089` Registro de agentes externo como fonte única de verdade (Firestore)
- `111` Identidades de commit autorizadas
- `122` Governança de nomenclatura de branches e PRs por tarefa
- `125` Declaração de agentes suportados

## Evidências

- `.agents/supported-agents.json`
- `ci-cd/check-pr-governance.js`
- `ci-cd/test/check-pr-governance.test.ts`
- `bun run pr:governance:check`
