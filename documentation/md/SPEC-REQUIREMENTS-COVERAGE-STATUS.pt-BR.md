<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md
Idioma alvo: Português (Brasil)
-->
# Status de cobertura dos requisitos de especificação

<!-- requirements-inventory: files=136 unique=136 mapped=136 duplicates= -->

Este documento certifica a cobertura atual dos requisitos implementados pelos recursos orientados ao desenvolvimento de especificações.

## Instantâneo da linha de base

Data: `2026-08-05`

1. Arquivos de requisitos em `.agents/requirements/project/` e `.agents/requirements/software/`: `136`
2. IDs de requisitos exclusivos: `136`
3. IDs cobertos em `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`: `136`
4. Status de cobertura: `100%`

Notas:

1. IDs duplicados `055`, `060` e `079` foram resolvidos renumerando os arquivos secundários para `122`, `123` e `124`; os requisitos `120` e `121` da branch `dev` são mantidos inalterados.
2. Requisitos agora estão fisicamente separados em `project/` (governança/processo) e `software/` (produto/técnico).
3. A cobertura é medida por IDs de requisitos exclusivos e por vinculação obrigatória de artefatos no razão.

## Cobertura de requisitos não funcionais

IDs NFR cobertos (`92`):

`001`, `011`, `014`, `015`, `016`, `017`, `018`, `020`, `025`, `029`, `036`, `041`, `042`, `043`, `044`, `050`, `053`, `056`, `057`, `063`, `064`, `065`, `066`, `067`, `068`, `069`, `070`, `071`, `072`, `073`, `074`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `088`, `089`, `090`, `091`, `092`, `093`, `094`, `095`, `096`, `097`, `098`, `099`, `100`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`, `109`, `110`, `111`, `112`, `113`, `114`, `115`, `116`, `117`, `118`, `119`, `120`, `121`, `122`, `124`, `125`, `126`, `127`, `128`, `129`, `130`, `131`, `132`, `133`, `134`, `135`, `136`

Fontes de mapeamento NFR:

1. `.agentes/NFR-REGISTRY.md`
2. `documentação/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`

## Cobertura de Requisitos Funcionais

IDs funcionais cobertos (`44`):

`002`, `003`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, `012`, `013`, `019`, `021`, `022`, `023`, `024`, `026`, `027`, `028`, `030`, `031`, `032`, `033`, `034`, `035`, `037`, `038`, `039`, `040`, `045`, `046`, `047`, `048`, `049`, `051`, `052`, `054`, `055`, `058`, `059`, `060`, `061`, `062`, `123`

Fontes de mapeamento funcional:

1. `documentação/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
2. OpenAPI/AsyncAPI e especificações técnicas de componentes referenciadas no razão

## Regra de vinculação

Qualquer novo requisito implementado não estará em conformidade até:

1. O artefato de requisito existe em `.agents/requirements/project/` ou `.agents/requirements/software/`
2. O ID do requisito é mapeado em `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
3. Os recursos de especificações correspondentes estão vinculados
4. O caminho da evidência (testes/verificações/gates) é definido
5. `bun run requirements:check` valida o índice, o mapeamento do livro-razão, os IDs duplicados e
   os marcadores bilíngues de inventário

## Ponteiros de auditoria

1. Matriz de cobertura: `documentation/md/SPEC-CANONICAL-COVERAGE-MATRIX.md`
2. Livro de requisitos: `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
3. Linha de base de conhecimento: `documentation/md/SPEC-CANONICAL-KNOWLEDGE-BASELINE.md`
4. Governança e rastreabilidade: `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
