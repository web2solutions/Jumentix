<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-COLLABORATION-PACKAGING.md
Idioma alvo: Português (Brasil)
-->
# Colaboração e empacotamento do Service Management

Este é o documento E8 da cadeia de documentação E1–E8 do Service Management
([JUM-494](https://linear.app/jumentix/issue/JUM-494/docs-e8-documentation-collaboration-and-packaging))
— o **último elo da cadeia e o portão terminal de documentação do épico sob o
[Requisito 094](../../.agents/requirements/project/094-epic-documentation-completion-gate.md)**:
o Project do Linear não pode ser marcado como `Completed` enquanto esta Issue
estiver em qualquer estado diferente de concluída.

Ele documenta a frente de colaboração e empacotamento exatamente como foi
entregue:

- **Colaboração** — o catálogo compartilhado multiusuário
  ([JUM-491](https://linear.app/jumentix/issue/JUM-491/feature-multi-user-shared-catalog-backend-sync-over-cana-resync-events)):
  um módulo de backend `Catalogs` contract-first, concorrência otimista por
  registro de catálogo, exclusão em tombstone com restauração e um cliente de
  sincronização no designer que converge por read-back do documento.
- **Versionamento de pacotes de domínio**
  ([JUM-492](https://linear.app/jumentix/issue/JUM-492/feature-domain-package-versioning-with-semantic-conflict-resolution)):
  os pacotes de domínio exportados são dados versionados, com grafo de
  dependências e resolução de conflitos determinística e explicável na
  importação.
- **Empacotamento**
  ([JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry)):
  **desescopado** — o núcleo modularizado do designer existe como fronteira
  de pacote, mas a etapa de publicação não foi entregue. Este documento o
  afirma explicitamente, porque um documento de portão que descreve o plano
  em vez da entrega seria um falso verde.

Por ser o portão terminal, seu conteúdo reflete **o que foi entregue**,
incluindo tudo o que foi postergado — cada desescopo abaixo é nomeado, não
silenciosamente omitido. A seção de fechamento da cadeia ao final é a
evidência do Req 094: ela nomeia a cadeia E1–E8 por completo e registra o
estado do portão.

Este documento é a referência em português. The English reference is in
[SERVICE-MANAGEMENT-COLLABORATION-PACKAGING.md](./SERVICE-MANAGEMENT-COLLABORATION-PACKAGING.md).

## Colaboração: o catálogo compartilhado (JUM-491)

Tudo antes do JUM-491 trata o designer como uma **ferramenta de navegador
único**: o Cana persiste o documento do designer no IndexedDB do navegador,
e o JUM-485 o sincroniza entre as abas desse navegador. O JUM-491 transforma
o designer em um **sistema multiusuário**: uma equipe compartilha um único
catálogo de desenhos de domínio através do backend — que é também a única
segunda cópia contínua do trabalho do usuário em hardware diferente (o Cana
não tem fallback; a exportação é manual).

O mecanismo completo pertence ao documento dedicado
[Sincronização de catálogo compartilhado](./SHARED-CATALOG-SYNC.pt-BR.md)
(arquitetura, contrato OAS, modelo de autorização, prova de convergência,
comandos de verificação). Este documento afirma o que a entrega significa
para o épico — a unidade de concorrência, o caminho de rejeição, a semântica
de exclusão e a regra de convergência — uma única vez, e remete a ele em vez
de manter uma segunda explicação divergente.

### O que foi entregue

- **Um módulo de backend `Catalogs` contract-first**
  ([`apps/backend-template/src/modules/Catalogs/domain/Model/Catalog.ts`](../../apps/backend-template/src/modules/Catalogs/domain/Model/Catalog.ts)),
  hexagonal como o módulo de referência Users: agregado de domínio (incremento
  de versão, tombstone, restauração),
  [`CatalogAuthorizationPolicy`](../../apps/backend-template/src/modules/Catalogs/domain/security/CatalogAuthorizationPolicy.ts)
  puro, casos de uso
  ([`CatalogUseCases.ts`](../../apps/backend-template/src/modules/Catalogs/application/use-cases/CatalogUseCases.ts)),
  o ponto de aplicação da concorrência otimista
  ([`CatalogDataRepository.ts`](../../apps/backend-template/src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository.ts)),
  o
  [`CatalogController`](../../apps/backend-template/src/modules/Catalogs/adapters/in/http/controllers/CatalogController.ts)
  validado pela OAS e a composição
  ([`composeCatalogsServices.ts`](../../apps/backend-template/src/modules/Catalogs/composition/composeCatalogsServices.ts)).
  Seis operações em `/catalogs` na
  [`spec/1.0.0.yml`](../../spec/1.0.0.yml) canônica — listar, criar, obter,
  atualizar, excluir, restaurar — garantidas por `bun run oas:check-routes`.
- **Concorrência otimista por registro de catálogo.** O registro (um desenho
  de domínio compartilhado) é a unidade de concorrência declarada: grosso o
  bastante para que um relacionamento entre duas entidades sempre tenha uma
  versão consistente a verificar, fino o bastante para que colegas nunca se
  bloqueiem entre domínios. O token `version` gerenciado pelo servidor começa
  em 1 na criação e incrementa a cada escrita; uma escrita obsoleta é
  rejeitada com um **409 revisável** cujos metadados carregam `catalogId`,
  `expectedVersion`, `currentVersion` **e o registro atual** — a edição
  perdedora nunca é descartada.
- **Exclusão é tombstone, recuperável.** A exclusão define `deletedAt` e
  incrementa a versão, de modo que a exclusão se propaga no read-back; uma
  cópia localmente modificada gera um conflito `deleted-remotely` em vez de
  desaparecer; `POST /catalogs/{id}/restore` recupera o registro.
- **Autorização no servidor, alinhada ao TENANT-RBAC.** A matriz de papéis
  ganha escopos de catálogo (`admin`: read/create/update/delete; `user`:
  read/create/update — membros da equipe editam, apenas admins excluem), e a
  política de tenant vincula o catálogo a exatamente uma organização. Um
  cliente não pode conceder acesso a si mesmo — provado por testes de
  integração positivos/negativos. Veja
  [Contrato de autorização de tenant e RBAC](./TENANT-RBAC-AUTHORIZATION-CONTRACT.pt-BR.md).
- **Eventos no mediador.** Toda escrita bem-sucedida publica
  `catalogs.catalog.created | updated | deleted | restored` com
  `{ id, organization, version, actor }` — o mesmo token de versão que a API
  aplica — no message mediator
  ([`CatalogService.ts`](../../apps/backend-template/src/modules/Catalogs/service/CatalogService.ts));
  a publicação nunca quebra a escrita primária.
- **Um cliente de sincronização do designer livre de DOM**
  ([`apps/service-management/src/state/catalogSyncClient.js`](../../apps/service-management/src/state/catalogSyncClient.js)):
  um consumidor irmão do mesmo fluxo de eventos confirmados do Cana que a
  sincronização de abas do JUM-485 assina. Commits locais agendam um push
  com debounce dos domínios compartilhados modificados (modificação decidida
  pelo marcador durável `domain.context.catalog = { id, version,
  contentHash }`, carregado aditivamente pelo padrão do JUM-492); a
  convergência é um **read-back do documento** por polling, diferenciado por
  `(id, version)` — a regra de ressincronização do Cana aplicada através da
  rede: uma lacuna é um sinal de recarga, nunca um replay de eventos, porque
  os cursores do Cana são por instância de cliente e não significam nada
  entre máquinas. Mudanças remotas atravessam o mesmo caminho único
  `applyRemoteDocument` da sincronização de abas, de modo que o isolamento de
  undo, a reconciliação de seleção e o truncamento de redo são idênticos.
- **Uma prova real de convergência.**
  [`catalogSync.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts)
  sobe o backend Express real (autenticação JWT real, mediador real) e
  executa dois clientes reais do designer sobre `fetch` real; um é
  particionado atrás de um `ECONNREFUSED` real, ambos continuam editando e,
  ao restabelecer, o read-back os converge — a edição particionada sobrevive
  como um conflito revisável, resolvido explicitamente (`take-server` /
  `take-local`, onde `take-local` é uma nova escrita deliberada contra a
  versão atual do servidor, nunca uma sobrescrita cega).

### O que o JUM-491 deliberadamente desescopou (candidatos ao carry-over de 12-01)

Nomeados em
[Sincronização de catálogo compartilhado](./SHARED-CATALOG-SYNC.pt-BR.md#o-que-foi-deliberadamente-desescopado-candidatos-ao-carry-over-de-12-01)
e reafirmados aqui porque o portão precisa vê-los:

- **Fan-out por WebSocket para os navegadores** (push em vez de poll): os
  adaptadores de broker existem em `packages/message-mediator`, mas nenhum
  fan-out para clientes do designer está ligado; o read-back por polling é
  correto sob qualquer escolha de broker.
- **Chrome de UI de compartilhamento/conflito no designer**: o módulo cliente
  é livre de DOM e combinável; as superfícies de
  compartilhar/descompartilhar/conflito (e a UX do provedor de token) são um
  trabalho futuro.
- **Escritas condicionais nativas no nível do driver**: o read-check-write do
  repositório é o comportamento de referência; os drivers de produção devem
  depois mapear a mesma verificação para condicionais nativas de
  `IStoreMutationOptions.expectedVersion`.
- **Fila de intenção de exclusão offline**: uma exclusão local offline de um
  domínio compartilhado não pode ser enviada; o registro sobrevivente no
  servidor é readmitido no read-back — a fronteira "o documento confirmado
  vence", com escopo de sessão por desenho nesta fatia.

### O que isto muda para o usuário — e o que não muda

Antes do JUM-491, o designer era por navegador e **a exportação era a única
forma de o trabalho sair da máquina** — o documento E6,
[Adoção do Cana, migração e comportamento offline do Service Management](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md),
é o dono dessa história de dados e este documento não a repete. O catálogo
compartilhado adiciona a via que faltava: o trabalho que o usuário
*compartilha* agora vive no servidor e converge entre máquinas. Duas
fronteiras honestas permanecem, afirmadas de antemão:

- **Um alvo de sincronização não é um backup.** Ele propaga exclusões; não
  substitui a política de quota/expulsão de armazenamento nem o contrato de
  durabilidade offline.
- **O Cana ainda não tem fallback.** Quando o catálogo está inalcançável, o
  cliente o declara (`degraded` na superfície de status) e continua salvando
  localmente no Cana — nunca degrada silenciosamente para um modo oculto de
  usuário único.

## Versionamento de pacotes de domínio (JUM-492)

Um pacote de domínio (a exportação `<domain>-package.json`) é **dado
versionado, não código**, e a importação é uma política determinística em vez
de um acréscimo incondicional. O contrato público está fixado no
[Requisito 126, Contrato 3](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md);
a implementação vive em
[`src/packages/packageVersioning.js`](../../apps/service-management/src/packages/packageVersioning.js)
(livre de DOM), ligada através do exportador
([`buildDomainPackageDocument`](../../apps/service-management/src/exporters/designerExporters.js))
e do importador
([`designerImporters.js`](../../apps/service-management/src/importers/designerImporters.js)).

### O documento de pacote versionado

A exportação emite o formato v2 `{ kind: "domain-package", version: "2.0.0",
exportedAt, package: { name, version, dependencies: [{ name, range }] },
domain }`. O bloco `package` declara a identidade a partir do contexto do
domínio: `packageName` (caindo para o nome do domínio), `packageVersion`
(caindo para `1.0.0`) e entradas de `packageDependencies` (`name@range`; um
nome puro é uma dependência apenas de presença). A compatibilidade é
explícita nas duas direções: documentos v1 legados continuam importando com
uma identidade `1.0.0` sintetizada; um documento cujo major é mais novo que
o do importador, ou um `kind` diferente de `domain-package`, é recusado com
clareza.

### Semântica de versão, redefinida para um modelo de dados

Os significados habituais de semver não se mapeiam a um modelo de dados,
então o Requisito 126 os redefine:

- **patch** — apenas documentação/metadados (descrições de campos, formatos,
  constraints, texto de contexto do domínio, dicas de composição OAS);
- **minor** — estrutura aditiva (uma nova entidade, campo ou contrato de
  mensagem; uma flag required afrouxada);
- **major** — remoção ou estreitamento (uma entidade/campo/contrato removido,
  mudança de tipo de campo ou de PK/FK/unique, uma flag required
  endurecida, uma mudança de RBAC ou de invariante, uma mudança de declaração
  de agregado).

### Proveniência e o registro de pacotes instalados

O conteúdo importado é carimbado: o domínio carrega `context.provenance =
{ package, version }` mais `context.packageName`/`context.packageVersion`, e
cada entidade importada carrega `meta.provenance`. Os normalizadores carregam
esses campos **aditivamente** — apenas quando a origem os declara — de modo
que payloads pré-JUM-492 permanecem inalterados e a proveniência atravessa
armazenamento, cargas e a exportação full-suite intacta. O registro de
pacotes instalados deriva da proveniência **somente**: um domínio construído
à mão nunca é uma instalação, então importar um pacote com nome igual ao de
um domínio local acrescenta (com a recomputação de ids do JUM-617) em vez de
fundir com conteúdo não relacionado.

### O grafo de dependências

As dependências resolvem transitivamente sobre o registro com o pacote
entrante sobreposto. Os ranges seguem a convenção npm: `*`/vazio (qualquer),
exato `1.2.3`, caret `^1.2.3` (mesmo major; para `0.x`, mesmo minor), til
`~1.2.3` (mesmo major.minor); qualquer outra coisa é inválida e não satisfaz
nada, então é reportada em vez de silenciosamente aceita. Uma dependência
ausente ou incompatível com o range é **reportada** pela região de status e
a importação prossegue — o designer reporta, não é o resolvedor. Um ciclo
que o pacote entrante fecharia é reportado pela cadeia de nomes e a
importação é **recusada** — ciclos são detectados, nunca percorridos.

### Resolução semântica de conflitos

Reimportar um pacote instalado resolve de forma determinística e explicável:

- **mesma versão + conteúdo igual → no-op** — reimportação idempotente,
  provada por teste;
- **mesma versão + conteúdo diferente → recusado** (`same-version-conflict`,
  com as divergências listadas — imutabilidade de versão);
- **versão mais antiga → recusado** (`downgrade-rejected`);
- **versão mais nova → merge.** Mudanças aditivas e de metadados (semântica
  patch/minor — `AUTO_MERGE_CLASSES`) aplicam-se automaticamente. Remoções,
  estreitamentos e **sempre RBAC e invariantes**
  (`REQUIRES_DECISION_CLASSES`) mantêm o conteúdo existente do designer e são
  listados na **prévia de merge**, renderizada na superfície de schema-diff
  antes que qualquer coisa mude; o merge só se aplica após o usuário aceitar
  explicitamente (um `window.confirm` com portão — um dos portões de ação
  destrutiva que o JUM-543 deliberadamente mantém). RBAC e invariantes estão
  sempre na classe de decisão: resolver automaticamente uma política de
  segurança ou uma invariante de domínio é uma decisão que um algoritmo de
  merge não deve tomar. Todos os resultados emergem via `showStatus`, nunca
  `alert()`.

A correspondência de entidades dentro de um merge é por nome, nunca por id:
ids colidentes são recomputados na importação pela regra do
[JUM-617](https://linear.app/jumentix/issue/JUM-617/fix-importdomainpackage-recompute-domainentity-ids-on-re-import),
de modo que ids jamais podem ser a chave de correspondência; novas entidades
entrantes recebem ids livres de colisão através do callback `uniqueId` do
importador.

**Provado por:**
[`designerPackageVersioning.test.ts`](../../apps/backend-template/test/unit/service-management/designerPackageVersioning.test.ts)
(parsing/ordenação de versões, satisfação de ranges, parsing de dependências
e resolução transitiva, detecção de ciclos, toda classe de conflito),
[`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts)
(exportação→importação versionada deep-equal com proveniência, ponto fixo de
reexportação, reimportação idempotente, recusa de reimportação conflitante,
merge determinístico com RBAC preservado, pares de dependências
compatíveis/incompatíveis, JUM-617 preservado no caminho de acréscimo) e
[`designerExporters.test.ts`](../../apps/backend-template/test/unit/service-management/designerExporters.test.ts)
(o formato do documento de pacote v2, fixado).

## Empacotamento: o núcleo do designer `@jumentix` (JUM-493) — desescopado

**Esta frente não foi entregue, e este documento o afirma claramente.** O
JUM-493 — publicar o núcleo do designer livre de framework como um pacote
`@jumentix` versionado sob a organização xpertminds — está em **Backlog**; é
a decisão de desescopo de 12-01 desta frente do épico. O que existe e o que
não existe:

- **O que existe: a fronteira de pacote.** O JUM-468/JUM-469 modularizou o
  designer de modo que o núcleo *é* uma coisa separável: a lógica pura vive
  em módulos livres de DOM sob `apps/service-management/src/` (`state`,
  `store`, `model`, `validation`, `exporters`, `importers`, `packages`,
  `codegen`), o acesso ao DOM vive no módulo de entrada, e o conjunto livre
  de DOM é exatamente o que um pacote poderia distribuir. O documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md),
  é o dono dessa fronteira e de sua justificativa; foi escrito com este
  consumidor em mente.
- **O que não existe: o pacote.** Nenhum `package.json`, ponto de entrada,
  declaração de tipos ou fiação de publicação do núcleo do designer foi
  entregue; o manifesto do workspace
  ([`apps/service-management/package.json`](../../apps/service-management/package.json))
  permanece `private: true`. A barra de aceite que o JUM-493 define — o
  núcleo carregando e executando em um ambiente sem DOM, sem `document`,
  `window` ou `localStorage`, provado por um teste de fumaça de consumidor
  contra o artefato publicado — está por definição não atendida: não há
  artefato.
- **O que o pacote conteria, quando a frente for retomada** (conforme a
  issue): o modelo de domínio e seus normalizadores, o motor de
  validação/checagem de modelo, os exportadores (JSON, Markdown, JSON Schema,
  AsyncAPI, boilerplate bundle, package, OAS), os importadores (pacote de
  domínio, arquivo de estado, arquivo OAS) e o motor de schema-diff — com o
  `IDesignerStore` publicado apenas como tipo/contrato. **Fora**: todo módulo
  DOM, o canvas, os inspetores, as superfícies de status e os adaptadores de
  armazenamento (o `CanaDesignerStore` é distribuído com o pacote próprio do
  Cana, não aqui).
- **A política de publicação permanece independentemente.** Quando a frente
  for retomada, a publicação continua **somente dry-run** por política — o
  [Requisito 070](../../.agents/requirements/project/070-xpertminds-npm-and-web2solutions-vercel-integration.md)
  proíbe publicação automática; o repositório já expõe a superfície de
  dry-run (`npm:org:check:xpertminds`, `npm:publish:dry-run:packages`) sobre
  a qual a frente será construída.

A consequência prática para o usuário permanece a do documento E6:
**a exportação é como o trabalho sai da máquina** — como documento
full-suite ou como pacote de domínio versionado — e o catálogo
compartilhado (acima) é a única segunda cópia contínua.

### A exportação full-suite (JUM-547), o pacote portátil

A exportação JSON é o documento full-suite versionado
(`{ kind: "service-management-suite", version: "2.0.0", domains,
relationships, interfaces, serviceConfiguration, runtimeEnvironment,
deployments, view }`) carregando **as quatro abas** em um formato
reimportável
([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration)).
Uma decisão de segurança registrada importa para o empacotamento: o pacote
carrega **somente a seleção** do ambiente de runtime (`{ environment,
fileName }`) — **nunca valores**, porque os valores espelham o conteúdo real
de `.env` da máquina onde o designer roda. Nenhum segredo pode sair em um
pacote; na importação a seleção é restaurada e os valores da máquina local
são preservados. O contrato está fixado no Requisito 126, Contrato 3; o
documento E5,
[Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md),
é o dono do lado do console de operações da história do ambiente de runtime.

## Fechamento da cadeia: a evidência do portão E1–E8 (Req 094)

Esta seção é a evidência do portão de documentação do épico: a cadeia nomeada
por completo, o estado de cada elo e as fronteiras de propriedade que impedem
que dois documentos divirjam sobre o mesmo comportamento.

**A cadeia publicada.** A cadeia se chama E1–E8; o projeto publicou **sete**
issues de documentação dedicadas — E1 e E3 até E8. **Nenhuma issue de
documentação E2 existe no projeto** (uma auditoria da lista de issues do
projeto confirma que nenhuma foi criada), então o portão fecha sobre os sete
documentos publicados:

| Elo | Issue | Documento | Estado |
|---|---|---|---|
| E1 | [JUM-464](https://linear.app/jumentix/issue/JUM-464/docs-e1-documentation-enpt-runtime-env-contract-and-fixed-paths) | [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md) | Done |
| E3 | [JUM-473](https://linear.app/jumentix/issue/JUM-473/docs-e3-documentation-module-architecture-and-storage-port-contract) | [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md) | Done |
| E4 | [JUM-479](https://linear.app/jumentix/issue/JUM-479/docs-e4-documentation-contract-parity-guarantees) | [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md) | Done |
| E5 | [JUM-482](https://linear.app/jumentix/issue/JUM-482/docs-e5-documentation-operations-console) | [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md) | Done |
| E6 | [JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior) | [Adoção do Cana, migração e comportamento offline do Service Management](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md) | Done |
| E7 | [JUM-490](https://linear.app/jumentix/issue/JUM-490/docs-e7-documentation-design-system-and-pwa-shell) | [Design system e shell PWA do Service Management](./SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.pt-BR.md) | Done |
| E8 | [JUM-494](https://linear.app/jumentix/issue/JUM-494/docs-e8-documentation-collaboration-and-packaging) | este documento | este PR |

Cada elo é publicado em EN e PT-BR, sincronizados conforme o
[Requisito 076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md)
— nenhum dos artefatos é um stub.

**Consistência: um dono por comportamento, os demais remetem.** A cadeia foi
auditada contra descrições duplicadas e divergentes; onde dois documentos
tocam o mesmo comportamento, a propriedade é:

- **A história dos dados** (onde o trabalho vive, a migração unidirecional,
  o comportamento offline dos dados, a exportação como único caminho de
  recuperação) — pertence ao **E6**; o E7 afirma a fronteira shell↔dados uma
  única vez e remete, e este documento remete para a linha de base
  por-navegador que o catálogo compartilhado estende.
- **O contrato da porta de armazenamento e a fronteira de módulos livre de
  DOM** — pertence ao **E3**; este documento remete para a fronteira de
  empacotamento em vez de derivá-la novamente.
- **O contrato de exportação e o contrato de pacotes de domínio** — fixados
  pelo **Requisito 126** (Contrato 3), com as garantias de paridade
  pertencendo ao **E4**; este documento ensina o comportamento do JUM-492 e
  cita o contrato em vez de reafirmá-lo.
- **A semântica de arquivos env/enums e a API de runtime-env** — pertence ao
  **E1**; o **E5** é o dono das superfícies do console de operações que as
  consomem, incluindo o contrato de superfície de status que todos os
  documentos acima referenciam.
- **O mecanismo do catálogo compartilhado** — pertence a
  [Sincronização de catálogo compartilhado](./SHARED-CATALOG-SYNC.pt-BR.md)
  (o documento dedicado do JUM-491); este documento afirma o significado da
  entrega para o épico e remete.

**Estado do portão, exatamente.** Sob o Req 094, o Project não pode ser
marcado como `Completed` até que esta Issue esteja concluída. Neste PR: E1,
E3–E7 estão Done; o E8 é entregue por este PR e transiciona somente após o
merge. Nenhuma verificação pendente é descrita como passando aqui: os
artefatos do JUM-491 que este documento referencia
(`SHARED-CATALOG-SYNC.md`, `catalogSyncClient.js`, o módulo `Catalogs`, o
teste de convergência) chegam com o PR próprio deles, e a frente de
empacotamento do JUM-493 está em Backlog pela decisão de desescopo de 12-01
— ambos afirmados, não suavizados. A evidência de conclusão do Project
conforme o Req 094 (ligando esta Issue, seu PR e a evidência de commits, e
os resultados de validação de integridade da documentação) é registrada no
feed de Project Updates do épico conforme o
[Requisito 102](../../.agents/requirements/project/102-linear-project-task-progress-updates.md)
quando o portão fecha.

## O que este documento deliberadamente não cobre

- **O mecanismo do catálogo compartilhado por completo** — pertence a
  [Sincronização de catálogo compartilhado](./SHARED-CATALOG-SYNC.pt-BR.md):
  a tabela do contrato OAS, a matriz de decisão de autorização, a API do
  cliente de sincronização e os comandos de verificação.
- **A história de dados por navegador** — pertence ao documento E6,
  [Adoção do Cana, migração e comportamento offline do Service Management](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md);
  este documento a referencia para a linha de base que o catálogo
  compartilhado estende.
- **A porta de armazenamento e a fronteira de módulos** — pertence ao
  documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md).
- **As garantias de paridade de exportação e o texto completo do contrato** —
  pertencem ao documento E4,
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md),
  e estão fixados no
  [Requisito 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).
- **O console de operações** (Service Configuration, o editor de ambiente de
  runtime, a prévia PM2, o Deploy Management) — pertence ao documento E5,
  [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md).

## Referências

- Colaboração (JUM-491):
  [`apps/backend-template/src/modules/Catalogs/domain/Model/Catalog.ts`](../../apps/backend-template/src/modules/Catalogs/domain/Model/Catalog.ts),
  [`domain/security/CatalogAuthorizationPolicy.ts`](../../apps/backend-template/src/modules/Catalogs/domain/security/CatalogAuthorizationPolicy.ts),
  [`application/use-cases/CatalogUseCases.ts`](../../apps/backend-template/src/modules/Catalogs/application/use-cases/CatalogUseCases.ts),
  [`service/CatalogService.ts`](../../apps/backend-template/src/modules/Catalogs/service/CatalogService.ts),
  [`adapters/out/persistence/CatalogDataRepository.ts`](../../apps/backend-template/src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository.ts),
  [`adapters/in/http/controllers/CatalogController.ts`](../../apps/backend-template/src/modules/Catalogs/adapters/in/http/controllers/CatalogController.ts),
  [`composition/composeCatalogsServices.ts`](../../apps/backend-template/src/modules/Catalogs/composition/composeCatalogsServices.ts),
  [`spec/1.0.0.yml`](../../spec/1.0.0.yml),
  [`apps/service-management/src/state/catalogSyncClient.js`](../../apps/service-management/src/state/catalogSyncClient.js),
  [Sincronização de catálogo compartilhado](./SHARED-CATALOG-SYNC.pt-BR.md)
- Versionamento de pacotes de domínio (JUM-492):
  [`src/packages/packageVersioning.js`](../../apps/service-management/src/packages/packageVersioning.js),
  [`src/exporters/designerExporters.js`](../../apps/service-management/src/exporters/designerExporters.js),
  [`src/importers/designerImporters.js`](../../apps/service-management/src/importers/designerImporters.js)
- Empacotamento (JUM-493, desescopado):
  [`apps/service-management/package.json`](../../apps/service-management/package.json)
  (`private: true`), a fronteira livre de DOM sob
  [`apps/service-management/src/`](../../apps/service-management/src)
- Suítes:
  [`catalogSyncClient.test.ts`](../../apps/backend-template/test/unit/service-management/catalogSyncClient.test.ts),
  [`catalogSync.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts),
  [`designerPackageVersioning.test.ts`](../../apps/backend-template/test/unit/service-management/designerPackageVersioning.test.ts),
  [`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts),
  [`designerExporters.test.ts`](../../apps/backend-template/test/unit/service-management/designerExporters.test.ts)
- Requisitos:
  [094](../../.agents/requirements/project/094-epic-documentation-completion-gate.md)
  (portão de conclusão de documentação do épico),
  [076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md)
  (paridade EN/PT),
  [070](../../.agents/requirements/project/070-xpertminds-npm-and-web2solutions-vercel-integration.md)
  (publicação somente dry-run),
  [102](../../.agents/requirements/project/102-linear-project-task-progress-updates.md)
  (atualizações de projeto),
  [126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
  (propriedade e contratos públicos, Contrato 3)
- Documentos irmãos da cadeia E:
  [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md) (E1),
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md) (E3),
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md) (E4),
  [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md) (E5),
  [Adoção do Cana, migração e comportamento offline do Service Management](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md) (E6),
  [Design system e shell PWA do Service Management](./SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.pt-BR.md) (E7),
  [Aplicativo Service Management](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md),
  [Contrato de autorização de tenant e RBAC](./TENANT-RBAC-AUTHORIZATION-CONTRACT.pt-BR.md)
- Linear:
  [JUM-491](https://linear.app/jumentix/issue/JUM-491/feature-multi-user-shared-catalog-backend-sync-over-cana-resync-events),
  [JUM-492](https://linear.app/jumentix/issue/JUM-492/feature-domain-package-versioning-with-semantic-conflict-resolution),
  [JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry),
  [JUM-494](https://linear.app/jumentix/issue/JUM-494/docs-e8-documentation-collaboration-and-packaging),
  [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration),
  [JUM-617](https://linear.app/jumentix/issue/JUM-617/fix-importdomainpackage-recompute-domainentity-ids-on-re-import)
