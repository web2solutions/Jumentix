# Requisitos Operacionais de Agente 114–119

Restrições canônicas adicionadas em 2026-08-01 sob o Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595).

| ID | Título | Regra em uma linha |
| --- | --- | --- |
| `114` | Layout de worktree do agente | Confirmar a raiz do filesystem com o operador humano e trabalhar só em `<raiz>/<agent-identifier>/Jumentix`. |
| `115` | Testes funcionais com valor | Testes são obrigatórios; sem suites fake/vacuosas; não testar API de implementação de terceiros; afirmar comportamento Jumentix. |
| `116` | Releitura dual-branch | Antes de cada tarefa, reler todos os `.agents/requirements/*` e o NFR registry em `origin/dev` e `origin/main`; evitar retrabalho. |
| `117` | Documentação de feature | Toda nova feature atualiza a documentação do software e adiciona docs da feature (EN/PT) na mesma entrega. |
| `118` | Smoke/integration com Docker | Suites de smoke e integration sobem serviços reais com Docker e exercitam a superfície declarada; skip silencioso não é verde. |
| `119` | Orquestração via API | Preferir APIs (ou CLIs oficiais) a automação de browser/app para Linear, GitHub e outros; GitHub deve sempre usar `gh`. |

## Arquivos de requisito

- `.agents/requirements/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/117-feature-documentation-on-new-features.md`
- `.agents/requirements/118-smoke-integration-docker-real-services.md`
- `.agents/requirements/119-api-first-service-orchestration-github-gh.md`

## Nota ao operador (Req 114)

No onboard, o agente deve confirmar a raiz do filesystem com o operador humano. A raiz confirmada **é** o diretório de workspace da org (em geral chamado `XpertMinds`). Layout:

```text
<raiz>/<agent-identifier>/Jumentix
```

**Confirmado neste host (2026-08-01):** `/Users/eduardoalmeida/apps/XpertMinds`  
Exemplo: `/Users/eduardoalmeida/apps/XpertMinds/cursor-grok-4.5/Jumentix`

Outros hosts ainda exigem confirmação in-band.

## Nota ao operador (Req 119)

Não dirigir Linear ou GitHub pelo browser quando a API GraphQL do Linear ou o `gh` puderem completar a operação. Fallback para UI só quando o caminho de API estiver indisponível ou o operador exigir passo humano na UI, registrando o bloqueio no Project Update do Linear.
