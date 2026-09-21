<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md
Idioma alvo: Português (Brasil)
-->
# Matriz de capacidades da fábrica de serviços Jumentix

## Objetivo

Defina os modos de fábrica de software suportados para Jumentix para que a engenharia e o produto possam escolher um formato de entrega com arquitetura e operações previsíveis.

## Matriz de Capacidade

| Modo de fábrica | CLI `--mode` | Como gerar | Resultado primário | Interfaces suportadas | Padrão de Comunicação | Estratégia de Persistência | Uso típico |
|---|---|---|---|---|---|---|---|
| Monólito Modular (Backend) | `monolith` | `jumentix init --mode=monolith --preset=users` (ou `--from`) | Serviço de back-end único com vários domínios | REST, substituto WebSocket + REST, substituto gRPC + REST, funções | Solicitação/resposta do MessageMediator em processo + pub/sub | Na memória, SQL, NoSQL via seleção de driver env | Produtos e equipes em estágio inicial otimizando velocidade com caminho de dissociação futuro |
| Grupo de back-end multisserviço | `services` | `jumentix init --mode=services --from=<export\|oas>` | Vários serviços de back-end em um espaço de trabalho | REST, WebSocket, gRPC, Funções | Mediador baseado em contrato e contratos de eventos por limite de serviço | Seleção de adaptador de banco de dados por serviço | Isolamento de domínio e escalonamento independente por contexto limitado |
| Back-end híbrido + front-end | `hybrid` | `jumentix init --mode=hybrid --frontend [--offline]` | Serviços de back-end mais aplicativos SPA/PWA/SSR | Contratos REST + em tempo real consumidos por clientes SDK | Contratos de API (OpenAPI/AsyncAPI) e integração primeiro do evento | Adaptador de backend mais estratégia de armazenamento local/offline de frontend | Entrega de produto ponta a ponta a partir de um monorepo |
| SPA/PWA off-line somente front-end | `frontend` | `jumentix init --mode=frontend [--offline] --from=<oas>` | Pacote de aplicativos frontend com compatibilidade de contrato API | Aplicativo local + consumo remoto opcional de API | Integração do SDK do cliente com foco no contrato | Armazenamento IndexedDB/local para fluxos offline | Aplicativos de campo e operações com capacidade off-line |

Designer de arquitetura (Service Management): **monólito** é um serviço Core com todos os
domínios. **Multi-serviço** é Core (Users + auth) mais serviços de domínio, cada um com URL
em `servers` no OAS.

Gerador: `@jumentix/cli-init` (`init` / `add` / `upgrade` / `doctor`). Superfície normativa:
[BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md).

## Seeds de Referência

- Seeds empacotados consumidos pela CLI: `packages/cli-init/templates/{backend,frontend}/`
  (reconstruídos a partir de `apps/backend-template` e `apps/frontend`).
- Modos backend: `apps/backend-template`.
- Modos híbrido e somente front-end: `apps/frontend` — ver
  [Seed de Frontend e o Kit X-CRUD](./FRONTEND-SEED-AND-XCRUD.pt-BR.md) (SPA dirigida pelo contrato
  sobre o [Contrato de Listagem Paginada](./PAGINATED-LIST-CONTRACT.pt-BR.md), com shell
  **multitarefa** protegido por login: um módulo por domínio, taskbar + panes keep-alive, registry
  de widgets da toolbar, breakpoints). Camada offline: [Camada de dados offline do frontend](./FRONTEND-OFFLINE-DATA-LAYER.pt-BR.md).

## Garantias Não Funcionais

- DDD + Limites hexagonais são obrigatórios para módulos backend.
- A integração orientada a eventos é priorizada para evitar acoplamentos rígidos e dependências circulares.
- Cada serviço gerado deve manter CI, cobertura, verificações de contrato e verificações de arquitetura habilitadas por padrão.
- A inicialização do tempo de execução deve ser orientada pelo ambiente e orquestrada por PM2 para contextos de VM.

## Contratos necessários por modo de fábrica

| Contrato | Monólito Modular | Back-end multisserviço | Híbrido | Somente front-end |
|---|---:|---:|---:|---:|
| Contratos de endpoint OpenAPI 3.1 | obrigatório | obrigatório | obrigatório (backend) | opcional (lado do consumidor) |
| Contratos em tempo real AsyncAPI | necessário quando o tempo real estiver ativado | necessário quando o tempo real estiver ativado | necessário quando o tempo real estiver ativado | opcional |
| Documentação do mapa de mensagens/eventos | obrigatório | obrigatório | obrigatório | opcional |
| Mapa de contrato de erro | obrigatório | obrigatório | obrigatório | recomendado |
| Documentos de entidade/modelo de dados | obrigatório | obrigatório | obrigatório | opcional |

## Critérios de aceitação

- O `--mode` da CLI (e o export de arquitetura do designer) mapeia para um dos modos acima.
- Os scaffolds gerados incluem arquivos de contrato necessários, `.jumentix/project.json` e scripts de qualidade padrão.
- O índice de documentação faz referência a esta matriz como a fonte canônica de capacidade do produto.
- Getting-started e docs de bootstrap descrevem geração via `@jumentix/cli-init`, não clone do monorepo.
