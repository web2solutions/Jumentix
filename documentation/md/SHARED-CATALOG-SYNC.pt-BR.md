# Sincronização do Catálogo Compartilhado (JUM-491)

> Catálogo multiusuário de designs de domínio: um módulo de backend
> contract-first (OAS + eventos no mediator) como alvo de sincronização,
> concorrência otimista por registro do catálogo e convergência guiada pela
> regra de ressincronização do Cana — read-back do documento, nunca replay.

Este documento é a referência em português. The English version is in
[SHARED-CATALOG-SYNC.md](./SHARED-CATALOG-SYNC.md).

## O que mudou e por quê

Tudo antes do JUM-491 trata o designer como uma **ferramenta de um único
navegador**: o Cana persiste o documento do designer no IndexedDB do
navegador, e o JUM-485 o sincroniza entre as abas desse navegador. O JUM-491
transforma o designer em um **sistema multiusuário**: um time compartilha um
único catálogo de designs de domínio através do backend, de modo que o
trabalho do usuário também vive em outro hardware — a única segunda cópia
contínua do produto (a exportação é manual).

Dois limites honestos, declarados desde já:

- **Um alvo de sincronização não é backup.** Ele propaga exclusões; não
  substitui o JUM-560 (quota de armazenamento/despejo) nem o JUM-415
  (conflitos offline e política de durabilidade).
- **O Cana continua sem fallback.** Quando o catálogo está inalcançável, o
  cliente declara o estado (superfície de status, `degraded`) e continua
  salvando localmente no Cana — nunca degrada silenciosamente para um modo
  oculto de usuário único, porque não existe store de fallback.

## Arquitetura

```
Designer A (navegador)              Backend (backend-template)              Designer B (navegador)
┌───────────────────────┐          ┌────────────────────────────┐          ┌───────────────────────┐
│ Cana (IndexedDB)      │          │ Módulo Catalogs (hexagonal)│          │ Cana (IndexedDB)      │
│  └ CanaDesignerStore  │          │  ├ OAS spec/1.0.0.yml      │          │  └ CanaDesignerStore  │
│  └ designerSync (abas)│          │  ├ CatalogController       │          │  └ designerSync (abas)│
│  └ catalogSyncClient ─┼── HTTP ─▶│  ├ CatalogUseCases/Service │◀── HTTP ─┼─ catalogSyncClient    │
│    poll: read-back    │          │  ├ CatalogDataRepository   │          │    poll: read-back    │
│    push: nos commits  │          │  └ publicação no mediator ─┼─ eventos │                       │
└───────────────────────┘          └────────────────────────────┘          └───────────────────────┘
```

### Backend: o módulo `Catalogs`

`apps/backend-template/src/modules/Catalogs/` segue a estrutura hexagonal de
módulos do repositório (Reqs 015/016/036), espelhando o módulo de referência
Users:

- **Domínio** — `domain/Entity/ICatalog.ts` (o registro),
  `domain/Model/Catalog.ts` (o agregado: incremento de versão, tombstone,
  restore), `domain/security/CatalogAuthorizationPolicy.ts` (decisões puras
  do TENANT-RBAC).
- **Aplicação** — `application/ports/ICatalogUseCases.ts`,
  `application/use-cases/CatalogUseCases.ts`; `features/*` são funções puras
  e finas sobre a porta do repositório.
- **Adapters** — `adapters/in/http/controllers/CatalogController.ts`
  (`@Authorize()` + validação OAS + política de tenant antes de cada caso de
  uso); `adapters/out/persistence/CatalogDataRepository.ts` (o ponto de
  aplicação da concorrência otimista).
- **Interface** — `interface/restapi/frameworks/{express,fastify,restify}/handlers/*`
  (seis operações), DTOs em `interface/dto/`.
- **Composição** — `composition/composeCatalogsServices.ts`, ligada em
  `RestAPI.composeCatalogsModule()` exatamente como o módulo Users; o driver
  in-memory registra `CatalogStoreAPI` no `InMemoryDbClient`.

### Contrato OAS

`spec/1.0.0.yml` (contract-first; `bun run oas:check-routes` garante):

| Operação | Caminho | Escopo | Concorrência |
|---|---|---|---|
| `getAll` | `GET /catalogs` | `read_catalog` | `includeDeleted=true` retorna tombstones |
| `create` | `POST /catalogs` | `create_catalog` | servidor atribui `version: 1` |
| `getOneById` | `GET /catalogs/{id}` | `read_catalog` | — |
| `update` | `PUT /catalogs/{id}` | `update_catalog` | `version` no corpo; desatualizada → 409 |
| `deleteOne` | `DELETE /catalogs/{id}?version=` | `delete_catalog` | exclusão lógica (tombstone); desatualizada → 409 |
| `restore` | `POST /catalogs/{id}/restore` | `update_catalog` | recupera tombstone; desatualizada → 409 |

### Autorização (TENANT-RBAC)

No servidor, em duas camadas — um cliente não pode conceder acesso a si
mesmo:

1. **Matriz de escopos** (`Users/domain/security/Rbac.ts`): `admin` recebe
   `read/create/update/delete_catalog`; `user` recebe
   `read/create/update_catalog` (membros do time editam o catálogo
   compartilhado; só admins excluem); `superadmin` mantém `*`; principais com
   escopos legados diretos não têm escopo de catálogo e são negados.
2. **Política de tenant** (`CatalogAuthorizationPolicy`): o catálogo é
   compartilhado exatamente dentro de uma organização. Principais de tenant
   exigem organização, são vinculados a ela na criação, e leituras/escritas
   entre organizações são negadas com as mensagens fixas do contrato.

### Eventos

Cada escrita bem-sucedida publica no message mediator
(`packages/message-mediator`; o adapter in-memory nos testes, os adapters de
broker nas implantações que os habilitam):

- `catalogs.catalog.created | updated | deleted | restored` com payload
  `{ id, organization, version, actor }` — a versão é o mesmo token de
  concorrência que a API aplica, então consumidores reconciliam contra um
  único número. A publicação de eventos nunca quebra o fluxo principal.

## O modelo de concorrência otimista

- **Unidade de concorrência: o registro do catálogo** — um design de domínio
  compartilhado. Por registro é a granularidade certa para um time (sem
  bloqueio global do catálogo), e um relacionamento entre duas entidades
  sempre vive dentro do mesmo registro, então nunca falta uma versão
  consistente para verificar.
- **Token: `version`** (o etag). A criação começa em 1; toda escrita a
  incrementa; toda mutação exige a versão esperada pelo chamador.
- **Escrita desatualizada: rejeitada, de forma revisável.** Os metadados do
  `ConflictError` 409 carregam `catalogId`, `expectedVersion`,
  `currentVersion` **e o registro atual** — a edição perdedora nunca é
  descartada; ela reconcilia contra o estado real do servidor (o cliente do
  designer também re-lê no 409).
- **Caminho de rejeição no designer:** o conflito vira uma entrada explícita
  (`getConflicts()`), exibida na região de status, resolvida por
  `resolveConflict(id, 'take-server' | 'take-local')`. `take-local` republica
  contra a versão *atual* do servidor — uma escrita deliberada, nunca uma
  sobrescrita cega.

## Sincronização sobre os eventos de ressincronização do Cana

O lado do designer
(`apps/service-management/src/state/catalogSyncClient.js`) é um consumidor
irmão do mesmo fluxo de eventos confirmados do Cana que o `designerSync`
(JUM-485) assina:

- **Saída:** commits locais do Cana no documento de estado agendam um push
  com debounce de cada domínio compartilhado *sujo*. A sujeira é decidida por
  um marcador durável em
  `domain.context.catalog = { id, version, contentHash }` (aditivo, padrão de
  carregamento do JUM-492, Requisito 126 Contrato 3): `contentHash` é o JSON
  canônico do domínio **normalizado** sem o marcador, então o hash é estável
  através da própria normalização de carga/aplicação do designer.
- **Entrada:** o cliente consulta o catálogo e converge por **read-back do
  documento** — `GET /catalogs?includeDeleted=true`, diferenciado por
  `(id, version)` contra os marcadores. É a própria regra de
  ressincronização do Cana (JUM-413) aplicada através da rede: uma lacuna é
  um sinal de recarga, nunca replay de eventos (cursores do Cana são por
  instância de cliente e não significam nada entre máquinas).
- **Um único caminho de aplicação:** mudanças remotas atravessam
  `applyRemoteDocument` do `designerSync.js` — o mesmo caminho das mudanças
  originadas em abas — então reconciliação de seleção, isolamento do undo
  (mudanças remotas não são desfazíveis) e truncamento do redo se comportam
  de forma idêntica. Diferente do sync entre abas, o cliente então persiste
  via `saveState()`: para mudanças do catálogo, a verdade está no servidor,
  ainda não no Cana local.

## Convergência após partição

Provada, não afirmada:
`apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts`
sobe o backend Express **real** (autenticação JWT real, mediator real) em uma
 porta loopback efêmera e executa **dois clientes designer reais** sobre o
`fetch` real do Node. Bob é particionado ao ter seu transporte apontado para
uma **porta fechada** — um `ECONNREFUSED` real, não latência simulada. Os
dois lados continuam editando; ao curar, o read-back de Bob converge o novo
domínio de Alice, o domínio disputado aparece como conflito revisável (a
edição de Bob durante a partição sobrevive), e a resolução `take-server`
leva os dois clientes ao mesmo documento canônico.

## Semântica de exclusão

- **Excluir = tombstone.** O registro sobrevive com `deletedAt` preenchido e
  versão incrementada, então uma exclusão em um cliente se propaga para o
  próximo read-back de todos os outros: uma cópia local limpa é removida; uma
  cópia localmente suja gera um conflito `deleted-remotely` em vez de
  desaparecer.
- **Recuperável.** `POST /catalogs/{id}/restore` limpa o tombstone (uma
  escrita versionada, com seu próprio evento); os clientes readmitem o
  registro.
- **Exclusão local de um domínio compartilhado** é empurrada como delete
  enquanto online. Uma exclusão local offline não pode ser empurrada; o
  registro sobrevivente no servidor é então a verdade e o domínio é
  readmitido no read-back — a mesma resposta "o documento confirmado vence"
  que o designerSync dá para abas (o marcador é durável no Cana; a fila de
  intenção de exclusão tem escopo de sessão por decisão neste recorte).

## O que foi deliberadamente desescopado (candidatos ao carry-over de 12-01)

Entregue: o módulo de backend contract-first com seus testes, o cliente de
sincronização do designer ligado pela costura de sync existente, concorrência
otimista com caminho de rejeição revisável, exclusão por tombstone com
restore, eventos no mediator (adapter in-memory compilado para testes) e a
prova de convergência com partição real.

Fora deste PR:

- **Entrega de eventos do broker aos clientes designer** (push em vez de
  poll): os adapters RabbitMQ/BullMQ existem em `packages/message-mediator`,
  mas nenhum fan-out WebSocket para navegadores foi ligado; o cliente
  converge por read-back em poll, o que é correto sob qualquer broker.
- **Ligação na UI do designer**: superfícies de
  compartilhar/descompartilhar/resolução de conflitos no `script.js` — o
  módulo cliente é DOM-free e combinável; o chrome visual (e a UX do
  token-provider: o transporte já aceita um) fica para um follow-up.
- **Escritas condicionais no nível do driver**: o read-check-write do
  repositório é o comportamento de referência; drivers de produção devem
  empurrar a mesma verificação para condicionais nativas de
  `IStoreMutationOptions.expectedVersion`.

## Verificação

```bash
# módulo de backend (unitários + integração de API)
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  --testPathPattern "modules/Catalogs|Express/Catalogs"
# cliente do designer
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  apps/service-management/test/unit/catalogSyncClient.test.ts
# convergência de dois clientes sobre HTTP real após partição real
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts
# gates de contrato
bun run oas:check-routes && bun run arch:check-boundaries
```
