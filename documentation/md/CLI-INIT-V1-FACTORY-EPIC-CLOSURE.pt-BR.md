<!--
Arquivo gerado automaticamente a partir de: documentation/md/CLI-INIT-V1-FACTORY-EPIC-CLOSURE.md
Idioma alvo: Português (Brasil)
-->
# cli-init v1 Factory Epic — Registro de fechamento (Req 094)

Este é o registro de documentação / fechamento do épico do Project Linear
**[EPIC][CLI] @jumentix/cli-init v1: factory generator (init/add/upgrade/doctor)**
([JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella)).
É a evidência terminal de governança sob o
[Requisito 094](../../.agents/requirements/project/094-epic-documentation-completion-gate.md).

Ele nomeia a cadeia completa de Issues e registra evidência de PR e commit de
merge para cada entrega C1–C14 em `dev`. O comportamento do produto da CLI
factory é propriedade de
[Geradora de fábrica CLI (`@jumentix/cli-init`)](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md)
e da
[Matriz de capacidades da Service Factory](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md);
este documento registra e liga — não reafirma a semântica dos comandos.

Referência em português. English:
[CLI-INIT-V1-FACTORY-EPIC-CLOSURE.md](./CLI-INIT-V1-FACTORY-EPIC-CLOSURE.md).

## Identidade do épico

| Campo | Valor |
| --- | --- |
| Nome do épico | `[EPIC][CLI] @jumentix/cli-init v1: factory generator (init/add/upgrade/doctor)` |
| Project Linear | https://linear.app/jumentix/project/epiccli-jumentixcli-init-v1-factory-generator-initaddupgradedoctor-298d8d918e17 |
| Milestone | `cli-init v1 published — 2026-12-19` (alvo 2026-12-19) |
| Issue de fechamento | [JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella) |
| Issue dedicada de docs (portão Req 094) | [JUM-855](https://linear.app/jumentix/issue/JUM-855/docs-cli-v1-documentation-bootstrap-doc-rewrite-website-getting) |

**Estado do portão, exatamente.** Sob o Req 094 o Project Linear **não pode**
ser marcado como `Completed` enquanto esta Issue de documentação / fechamento
(**JUM-856**) não estiver `Done`, e a Issue dedicada de documentação de
produto (**JUM-855**) também deve estar `Done` antes da conclusão do Project.
Comentários e mudanças de status sozinhas não bastam: as Project Updates
(Req 102) devem carregar início, progresso material, review-ready e handoff
final com estados exatos dos gates — nunca descrever um check obrigatório
pendente, ausente, cancelado, expirado, pulado ou falho como passando.

## Cadeia publicada (C1–C14 / JUM-843…856)

A ordem do épico é C1 → C14. C11 (publicação) pode correr em paralelo com
C4/C5 após C2; C12 começa com C5; C13 é a Issue dedicada de documentação;
C14 é este registro de fechamento e fecha por último.

| Elo | Issue | Papel | Documento / superfície |
| --- | --- | --- | --- |
| C1 | [JUM-843](https://linear.app/jumentix/issue/JUM-843/governance-requirement-037-v2-factory-generator-rules-and-epic-record) | Governança — Req 037 v2 regras da geradora | `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`, linhas do ledger / NFR |
| C2 | [JUM-844](https://linear.app/jumentix/issue/JUM-844/refactor-cli-core-command-router-prompt-engine-config-file-typescript) | Refatoração — núcleo da CLI (router, prompts, config, build TypeScript) | `packages/cli-init` |
| C3 | [JUM-845](https://linear.app/jumentix/issue/JUM-845/feature-template-packaging-seeds-bundled-in-the-cli-with-a-freshness) | Feature — empacotamento de templates + gate de frescor | templates `packages/cli-init` / `check-template-freshness` |
| C4 | [JUM-846](https://linear.app/jumentix/issue/JUM-846/feature-source-resolution-designer-export-oas-catalog-url-or-users) | Feature — resolução de fontes → `GenerationPlan` | `packages/cli-init` |
| C5 | [JUM-847](https://linear.app/jumentix/issue/JUM-847/feature-backend-generation-core-service-and-domain-services-sliced) | Feature — geração de backend | `packages/cli-init` |
| C6 | [JUM-848](https://linear.app/jumentix/issue/JUM-848/feature-frontend-generation-frontend-seed-slice-with-one-module-per) | Feature — geração de frontend | `packages/cli-init` |
| C7 | [JUM-849](https://linear.app/jumentix/issue/JUM-849/feature-workspace-assembly-root-manifest-docker-git-readme-projectjson) | Feature — montagem do workspace | `packages/cli-init` |
| C8 | [JUM-850](https://linear.app/jumentix/issue/JUM-850/feature-add-domain-add-service-add-frontend-on-a-generated-project) | Feature — `add domain\|service\|frontend` | `packages/cli-init` |
| C9 | [JUM-851](https://linear.app/jumentix/issue/JUM-851/feature-upgrade-template-three-way-merge-with-report) | Feature — `upgrade` merge de três vias | `packages/cli-init` |
| C10 | [JUM-852](https://linear.app/jumentix/issue/JUM-852/feature-doctor-environment-and-project-diagnostics) | Feature — diagnósticos `doctor` | `packages/cli-init` |
| C11 | [JUM-853](https://linear.app/jumentix/issue/JUM-853/feature-publishing-jumentix-packages-and-the-cli-on-npm-under-release) | Feature — publicabilidade npm sob governança de release | pacotes `@jumentix/*` + CLI |
| C12 | [JUM-854](https://linear.app/jumentix/issue/JUM-854/test-generation-e2e-matrix-in-docker-and-cli-unit-suites) | Teste — matriz e2e de geração + suites da CLI | testes `packages/cli-init` / matriz Docker |
| C13 | [JUM-855](https://linear.app/jumentix/issue/JUM-855/docs-cli-v1-documentation-bootstrap-doc-rewrite-website-getting) | Docs — reescrita bootstrap, getting-started, matriz (portão Req 094) | [BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md), getting-started do site, matriz |
| C14 | [JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella) | Governança — registro e fechamento do épico (este documento) | este documento (+ EN) |

## Rastreabilidade: URL do PR + SHA do commit de merge

Todos os PRs de entrega C1–C14 entraram em `dev`. Os SHAs abaixo são os
commits de merge do GitHub (comando: `gh api repos/web2solutions/Jumentix/pulls/<n> --jq .merge_commit_sha`).

| Elo | Issue | URL do PR | SHA do commit de merge |
| --- | --- | --- | --- |
| C1 | JUM-843 | https://github.com/web2solutions/Jumentix/pull/371 | `1c84117f5dd9a39aa18e745fd7a81c5a6963a8f3` |
| C2 | JUM-844 | https://github.com/web2solutions/Jumentix/pull/373 | `9e1137a63a5e76feb7fd2a58124384d539217f34` |
| C3 | JUM-845 | https://github.com/web2solutions/Jumentix/pull/377 | `518645c302f434dbf94789180c24421231b7c893` |
| C4 | JUM-846 | https://github.com/web2solutions/Jumentix/pull/384 | `cdc0c846b76e8843de7eee5555a031d8b99be8f1` |
| C5 | JUM-847 | https://github.com/web2solutions/Jumentix/pull/386 | `5987d41574cdcb944bb4581f7627bb2ed11f3e49` |
| C6 | JUM-848 | https://github.com/web2solutions/Jumentix/pull/387 | `9e37ad64bd034e4b710c197d22be62f0ef007d8e` |
| C7 | JUM-849 | https://github.com/web2solutions/Jumentix/pull/388 | `0d236b8f8079d514889c8ac9bd3ce61ad01bfbed` |
| C8 | JUM-850 | https://github.com/web2solutions/Jumentix/pull/389 | `1aa69de89420893b10a138e87610ce2bb034c287` |
| C9 | JUM-851 | https://github.com/web2solutions/Jumentix/pull/390 | `78bc4a8f92cf50052b3b727cb8bae8e1ab552133` |
| C10 | JUM-852 | https://github.com/web2solutions/Jumentix/pull/391 | `40bb147de7aa43b11eb5d8af2b690b81c29610fc` |
| C11 | JUM-853 | https://github.com/web2solutions/Jumentix/pull/379 | `d4d4f19c6124c3ad0d8b7eef16fc6914112630f0` |
| C12 | JUM-854 | https://github.com/web2solutions/Jumentix/pull/392 | `3e87a876b01e7bd0f963ea1f5aac00b92569c031` |
| C13 | JUM-855 | https://github.com/web2solutions/Jumentix/pull/394 | `a963054cd641652ee85330fde7309ff398256a79` |
| C14 | JUM-856 | https://github.com/web2solutions/Jumentix/pull/395 | `aa590173d47d2153a6a93e672cbaad7db9e1ffb5` |

**Publicabilidade vs npm ao vivo (Req 130).** JUM-853 tornou os pacotes
publicáveis e passou `bun run npm:packages:check` / `bun run release:dry-run:packages`.
A publicação ao vivo `0.1.0-rc.1` e o `npm view` **não** foram executados:
faltava `NPM_TOKEN` no ambiente de entrega. Não trate presença no registry
como concluída.

## Fontes governadas relacionadas

- [Geradora de fábrica CLI](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md) (+ EN)
- [Matriz de capacidades da Service Factory](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md) (+ EN)
- [Índice Spec Development Driven](./SPEC-DEVELOPMENT-DRIVEN-INDEX.pt-BR.md)
- [Ledger de rastreabilidade de requisitos](./SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.pt-BR.md)
- Requisito `037` (v2), Requisito `094`, Requisito `102`

## O que este documento deliberadamente não cobre

- Flags de comando, layout gerado e códigos de saída do doctor — propriedade de
  [BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md).
- Linhas da matriz de modos de fábrica — propriedade de
  [JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md).
- Detalhe de implementação em `packages/cli-init` — propriedade do pacote e
  das Issues de entrega acima.
