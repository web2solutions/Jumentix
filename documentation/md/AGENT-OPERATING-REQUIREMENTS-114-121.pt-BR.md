# Requisitos Operacionais de Agente 114–121

Restrições canônicas adicionadas em 2026-08-01 sob o Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595), com `120` e `121` adicionados por decisão do owner em 2026-08-02.

| ID | Título | Regra em uma linha |
| --- | --- | --- |
| `114` | Layout de worktree do agente | Confirmar a raiz do filesystem com o operador humano e trabalhar só em `<raiz>/<agent-identifier>/Jumentix`. |
| `115` | Testes funcionais com valor | Testes são obrigatórios; sem suites fake/vacuosas; não testar API de implementação de terceiros; afirmar comportamento Jumentix. |
| `116` | Releitura dual-branch | Antes de cada tarefa, reler todos os `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md` e o NFR registry em `origin/dev` e `origin/main`; evitar retrabalho. |
| `117` | Documentação de feature | Toda nova feature atualiza a documentação do software e adiciona docs da feature (EN/PT) na mesma entrega. |
| `118` | Smoke/integration com Docker | Suites de smoke e integration sobem serviços reais com Docker e exercitam a superfície declarada; skip silencioso não é verde. |
| `119` | Orquestração via API | Preferir APIs (ou CLIs oficiais) a automação de browser/app para Linear, GitHub e outros; GitHub deve sempre usar `gh`. |
| `120` | Visibilidade de assignment de agente no Linear | Issues e Projects/Epics no Linear devem identificar o agente ativo e sincronizar com o Agent Registry canônico. |
| `121` | Consciência coordenada de entrega entre agentes | Agentes registrados devem refrescar progresso, bloqueios, branches, PRs e Project Updates de agentes irmãos antes de iniciar ou retomar trabalho. |

## Arquivos de requisito

- `.agents/requirements/project/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/software/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/project/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/project/117-feature-documentation-on-new-features.md`
- `.agents/requirements/software/118-smoke-integration-docker-real-services.md`
- `.agents/requirements/project/119-api-first-service-orchestration-github-gh.md`
- `.agents/requirements/project/120-linear-agent-assignment-visibility.md`
- `.agents/requirements/project/121-registered-agent-coordinated-delivery-awareness.md`

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

## Nota ao operador (Req 120)

Antes de iniciar implementação, a Issue do Linear e seu Project/Epic devem mostrar qual agente registrado é dono da tarefa. O assignment no Linear, o Agent Registry canônico e o espelho local precisam concordar. Mudanças de assignment são progresso material e devem ser registradas pelo caminho API-first.

## Nota ao operador (Req 121)

Agentes não trabalham isolados. Antes de iniciar ou retomar trabalho, leia a atividade dos agentes irmãos no registry, nos Project Updates do Linear, nas Issues relacionadas, branches ativas e PRs abertos. Se outro agente registrado possuir escopo sobreposto, coordene handoff, dependência ou divisão de escopo antes de editar arquivos.
