# Requisitos Operacionais de Agente 114–118

Restrições canônicas adicionadas em 2026-08-01 sob o Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595).

| ID | Título | Regra em uma linha |
| --- | --- | --- |
| `114` | Layout de worktree do agente | Confirmar a raiz do filesystem com o operador humano e trabalhar só em `<raiz>/XpertMinds/<agent-identifier>/Jumentix`. |
| `115` | Testes funcionais com valor | Testes são obrigatórios; sem suites fake/vacuosas; não testar API de implementação de terceiros; afirmar comportamento Jumentix. |
| `116` | Releitura dual-branch | Antes de cada tarefa, reler todos os `.agents/requirements/*` e o NFR registry em `origin/dev` e `origin/main`; evitar retrabalho. |
| `117` | Documentação de feature | Toda nova feature atualiza a documentação do software e adiciona docs da feature (EN/PT) na mesma entrega. |
| `118` | Smoke/integration com Docker | Suites de smoke e integration sobem serviços reais com Docker e exercitam a superfície declarada; skip silencioso não é verde. |

## Arquivos de requisito

- `.agents/requirements/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/117-feature-documentation-on-new-features.md`
- `.agents/requirements/118-smoke-integration-docker-real-services.md`

## Nota ao operador (Req 114)

A raiz do filesystem **não** é fixa. No onboard, o agente deve perguntar ao operador humano qual raiz usar (por exemplo `$HOME/XpertMinds` ou `$HOME/apps/XpertMinds`) antes de criar `XpertMinds/<agent-identifier>/Jumentix`.
