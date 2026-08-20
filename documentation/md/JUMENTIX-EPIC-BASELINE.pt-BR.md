# Épico Jumentix — Baseline de Entrega e Registo de Conclusão

Registo de conclusão do Projeto Linear `Jumentix`, escrito para cumprir a regra 7 do
Requisito `094`: a evidência de conclusão de um Projeto deve ligar a Issue de documentação
concluída, o seu pull request e evidência de commit, e os resultados de validação da
integridade documental.

Este documento regista e liga. Não repete as 102 issues entregues — a documentação delas já
vive nas especificações e guias referenciados abaixo, e duplicá-la aqui criaria uma segunda
fonte que se afasta da primeira.

## O que foi este épico

O épico de produto original, aberto antes de o workspace adotar a taxonomia de tarefas
centrada em épicos. A maior parte do seu trabalho é anterior ao Requisito `094`, e é por
isso que chegou a 102 issues concluídas sem nenhuma Issue de documentação dedicada — o
portão não existia quando o épico começou.

| natureza | entregue |
| --- | --- |
| sem prefixo (pré-taxonomia) | 88 |
| Fix | 4 |
| DOC | 4 |
| Governance | 3 |
| CI | 2 |
| Release | 1 |

Mais três issues resolvidas como duplicadas. Cinco issues que nunca chegaram a ser
agendadas foram movidas antes da conclusão, em vez de fechadas como entregues:

- `JUM-49` login OAuth2/Auth0, `JUM-53` fila dead-letter, `JUM-54` Server-Sent Events e
  `JUM-60` adaptador web React passaram para **[EPIC][Platform] Deferred boilerplate
  features (2024 migration)**. As quatro foram migradas do repositório boilerplate original
  a 2024-06-03 e são anteriores à reestruturação hexagonal, à migração para Bun e ao
  adaptador Cana, pelo que nenhuma deve ser executada sem primeiro confirmar que continua a
  ter a forma certa.
- `JUM-44` aplicação de regras ESLint passou para **[Tooling] Adopt Airbnb Extended ESLint 9
  Flat Configuration**, onde vive o trabalho circundante.
- `JUM-158` gates de qualidade do website e Storybook passou para **[EPIC][Website] Rebuild
  Jumentix OSS product and documentation**, o seu pai real.

Movê-las é a razão pela qual este épico pode ser concluído honestamente. Marcar trabalho de
funcionalidade por agendar como entregue seria uma conclusão falsa ao nível do projeto — a
mesma classe de defeito que o Requisito `065` proíbe no portão.

## Documentação canónica do que foi entregue

As fontes governadas, todas bilingues:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md` — regras de branch, PR, promoção e
  portões.
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md` — mapeamento requisito-artefacto.
- `documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md` — certificação de cobertura.
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md` — o índice de especificações.
- `.agents/requirements/` — 129 requisitos entre `project/` e `software/`.
- `.agents/NFR-REGISTRY.md` — mapeamento de requisitos não funcionais.

A documentação de componentes e subsistemas entregue sob este épico e os seus sucessores é
indexada a partir do índice de especificações acima, e não listada aqui, para que acrescentar
um documento não obrigue a editar este ficheiro para ele continuar correto.

## Validação

Executada contra `dev` no momento em que este documento foi escrito:

| verificação | resultado |
| --- | --- |
| `bun run requirements:check` | 129 ficheiros, 129 IDs únicos, sem duplicados |
| suites de documentação e registo | passam |
| paridade bilingue, documentação governada | EN e PT-BR presentes em todos os documentos governados |

Cinco documentos em `documentation/md/` não têm par PT-BR:
`BUN-BRANCH-COVERAGE-SPIKE`, `BUN-INSTALL-COMPATIBILITY-AUDIT`,
`BUN-TAXONOMY-BASELINE-VALIDATION`, `PLATFORM-DEPENDENT-SUITES` e
`TEST-PYRAMID-ROLLOUT-REPORT`. São relatórios de investigação com data marcada, não
documentação governada bilingue, e a regra 4 do Requisito `094` liga a tradução a artefactos
governados. Ficam registados aqui para que a assimetria seja deliberada e visível, em vez de
parecer esquecimento.

## Relacionados

- [Versão em inglês](JUMENTIX-EPIC-BASELINE.md)
- Requisito `094` — portão de conclusão de documentação de épico.
- Requisito `065` — falsos verdes são proibidos, no portão e ao nível do projeto.
