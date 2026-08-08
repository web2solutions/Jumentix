<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md
Idioma alvo: Português (Brasil)
-->
# Console de operações do Service Management

Este é o documento E5 da cadeia de documentação E1–E8 do Service Management
([JUM-482](https://linear.app/jumentix/issue/JUM-482/docs-e5-documentation-operations-console)).
Ele documenta o **console de operações** — as superfícies que transformam o
designer de uma ferramenta de modelagem em algo que descreve e controla um
serviço em execução — exatamente como o código se comporta hoje, após a entrega
da frente do console de operações
([JUM-480](https://linear.app/jumentix/issue/JUM-480/feature-real-multi-environment-editing-and-pm2-ecosystem-preview),
[JUM-481](https://linear.app/jumentix/issue/JUM-481/feature-deploy-management-aligned-to-req-059-matrix-with-per-service),
[JUM-543](https://linear.app/jumentix/issue/JUM-543/fix-replace-blocking-alerts-with-non-blocking-status-surfaces-and),
[JUM-544](https://linear.app/jumentix/issue/JUM-544/fix-service-configuration-validation-port-conflicts-and-run-mode),
[JUM-546](https://linear.app/jumentix/issue/JUM-546/feature-deploy-target-lifecycle-edit-duplicate-and-field-validation)).

O console abrange a aba **Service Configuration** (perfil de runtime, a
prévia do ecossistema PM2 e o editor de ambiente de runtime), a aba **Deploy
Management** e — por suas regras de ciclo de vida — o **Communication
Interface Designer**. Essas abas carregam regras que um usuário não consegue
descobrir clicando: quais combinações de run-mode × cloud-provider e de
service-type × deploy-target são válidas e por que uma inválida é rejeitada,
qual arquivo de ambiente uma gravação escreve e de onde a prévia do PM2 obtém
sua lista de processos. Este documento torna essas regras legíveis, nomeia a
verificação que comprova cada uma e estabelece a regra da fonte compartilhada
que as impede de divergir.

Dois limites deliberados:

- **Os contratos de comunicação são referenciados, não duplicados.** A API de
  ambiente de runtime e o endpoint do ecossistema PM2 estão fixados no
  [Requisito 126, Contratos 1 e 1b](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md),
  e a semântica de arquivos env/enums no documento E1,
  [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md)
  ([JUM-464](https://linear.app/jumentix/issue/JUM-464/docs-e1-documentation-enpt-runtime-env-contract-and-fixed-paths)).
  Este documento os referencia; não os repete.
- **Persistência e comportamento de boot estão fora do escopo.** A porta de
  armazenamento e a migração de armazenamento pertencem ao documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md);
  suas promessas ao usuário — onde os dados vivem, os modos de perda e o
  recurso da exportação — pertencem ao documento E6,
  [Adoção do Cana no Service Management, migração e comportamento offline](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md).

## A matriz de capacidades compartilhada (JUM-544, JUM-481)

As duas superfícies de validação do console — Service Configuration e Deploy
Management — leem as matrizes do Requisito 059 de **uma única fonte legível por
máquina**:
[`apps/service-management/src/model/deployCapabilityMatrix.js`](../../apps/service-management/src/model/deployCapabilityMatrix.js),
o leitor dos dois documentos de matriz
([JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX](./JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.pt-BR.md)
e
[JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md)).

**A regra da fonte compartilhada:** a matriz é transcrita exatamente uma vez,
neste módulo. Um futuro contribuidor que estender ou corrigir a matriz edita
**o módulo fonte** — e os documentos de matriz no mesmo PR, como o próprio
cabeçalho do módulo exige — nunca uma segunda cópia dentro da validação de uma
aba. Os dois validadores do console já demonstram o porquê:

- `collectServiceConfigurationIssues`
  ([`serviceConfigurationValidation.js`](../../apps/service-management/src/validation/serviceConfigurationValidation.js),
  JUM-544) consome o mapa de suporte **run-mode × cloud-provider** e o mapa de
  portas ativas.
- `collectDeployTargetIssues`
  ([`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js),
  JUM-481) consome o mapa de suporte **service-type × deploy-target**, o mapa
  de protocolos por service type, o conjunto de targets gerenciados por PM2 e
  os vocabulários de drivers.

O que a matriz codifica, e por que uma combinação inválida é rejeitada:

- **Run mode × cloud provider.** `dedicated-server` roda em `self-hosted`;
  `virtual-machine` em `aws`/`google`/`azure`; `container` em `docker` ou
  `self-hosted`; `functions` em `aws`/`vercel`/`cloudflare`. Qualquer coisa
  fora dessas linhas (por exemplo `functions` + `self-hosted`, ou um run mode
  baseado em PM2 contra `vercel`) não tem deploy target na matriz do
  Requisito 059 — o design não poderia ser construído por nenhuma linha de
  empacotamento que a factory entrega, portanto é rejeitado em vez de
  registrado.
- **Service type × deploy target.** As linhas gerenciadas por PM2
  (`dedicated-server`, `vm`, `ec2`) aceitam serviços `restapi`,
  `websocket+restapi` e `grpc+restapi`; as linhas de funções (`lambda`,
  `vercel-functions`, `cloudflare-workers`) aceitam apenas `functions`. Um
  serviço `functions` em um target PM2 — ou um serviço REST/realtime em um
  target de funções — não tem linha na matriz.
- **Exposição de protocolos.** Um service type expõe apenas os protocolos que
  ele realmente vincula: `restapi` serve HTTP, `websocket+restapi` adiciona
  WebSocket, `grpc+restapi` adiciona gRPC, e APIs de funções são entrypoints
  HTTP. Pedir que um serviço `restapi` vincule WebSocket é rejeitado porque o
  runtime nunca iniciaria tal listener.
- **Aplicabilidade do perfil PM2.** Apenas targets gerenciados por PM2 carregam
  um `pm2Profile` (`dev`/`staging`/`production`); um perfil em um target
  gerenciado pelo provedor (serverless) é um design que a matriz não consegue
  construir, e um perfil ausente em um target gerenciado por PM2 deixa o
  perfil de ecossistema sem escolha.
- **Portas ativas por service kind.** Um serviço `rest-api` não vincula nenhum
  listener realtime, portanto suas portas WebSocket/gRPC não utilizadas não são
  validadas — apenas as portas que o service kind selecionado realmente vincula
  precisam ser inteiros em 1–65535 e mutuamente distintos.

Dois fatos de vocabulário que vale conhecer antes de estender a matriz:

- **Duas grafias coexistem por design.** O Service Configuration usa o
  vocabulário de armazenamento do Requisito 126 (`serviceKind`: `rest-api`,
  `websocket-rest-api`, `grpc-rest-api`); o Deploy Management usa as grafias
  da própria matriz (`serviceType`: `restapi`, `websocket+restapi`,
  `grpc+restapi`, `functions`), que são anteriores a ele. O módulo documenta a
  divergência em vez de disfarçá-la.
- **Os vocabulários de drivers espelham o contrato de ambiente de runtime por
  referência.** `databaseDriver`/`keyValueDriver` são definidos pela matriz do
  Requisito 059 como "o `JUMENTIX_DATABASE_DRIVER` selecionado", portanto o
  módulo espelha os conjuntos de enum do Contrato 1 — e a paridade é
  verificada por teste, não presumida (abaixo).

**Comprovado por:**
[`serviceConfigurationValidation.test.ts`](../../apps/backend-template/test/unit/service-management/serviceConfigurationValidation.test.ts)
e
[`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts)
— este último também lê o `script.js` e os enums da allowlist do `server.js`
para garantir que os vocabulários de drivers não possam divergir do contrato
de ambiente de runtime.

## Service Configuration: validar antes do estado (JUM-544)

O portão de gravação da aba valida o perfil candidato **antes de ele tocar o
estado** (`script.js`): `collectServiceConfigurationIssues` roda sobre os
valores do formulário, e cada issue tem severidade `error`, portanto um perfil
inválido é recusado e relatado na superfície de status da aba — o comportamento
anterior silenciosamente coagia portas ruins de volta aos padrões. O mesmo
coletor revalida o perfil persistido sempre que a aba é renderizada
(`renderServiceConfigStatus` em
[`inspectors.js`](../../apps/service-management/src/ui/inspectors.js)), de modo
que um estado inválido vindo do armazenamento é sinalizado em vez de exibido
como válido. As regras:

1. **Vocabulário** — `serviceKind`, `runMode` e `cloudProvider` precisam ser
   valores que o esquema de armazenamento (Requisito 126, Contrato 2) e os
   selects da UI conhecem.
2. **Portas** — cada porta que o service kind selecionado realmente vincula
   precisa ser um inteiro em 1–65535, e nenhum par de portas ativas pode
   colidir; portas inativas são ignoradas.
3. **Run mode × cloud provider** — a combinação precisa existir na matriz
   compartilhada (acima), e a rejeição nomeia os provedores que a matriz
   realmente suporta para o run mode escolhido.

## Edição multi-ambiente (JUM-480) — por referência cruzada

O contrato do editor de ambiente de runtime — ambientes aceitos e seu
mapeamento de arquivos, a classificação de chaves em três níveis (editável /
somente leitura / nunca exposta), conjuntos de enum por chave, semântica de
gravação e o envelope de erro — está fixado no
[Requisito 126, Contrato 1](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
e no documento E1,
[Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md).
O que este documento adiciona é apenas o comportamento desse contrato no lado
do console:

- **A edição é sequencial e por arquivo.** O seletor de Environment (`dev`,
  `staging`, `ci`) carrega exatamente um ambiente por vez através de
  `GET /api/runtime/env`; o painel sempre nomeia o arquivo exato que a próxima
  gravação escreve (`Editing target: .env.dev (environment "dev")`, direto do
  payload da API); e uma gravação escreve **somente aquele arquivo** — não
  existe edição em lote entre arquivos. A linha de direcionamento por arquivo
  é fixada por
  [`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts).
- **Um ambiente não aceito é rejeitado, nunca coagido.** O servidor resolve o
  parâmetro `environment` contra um conjunto explícito de valores aceitos
  (`dev`/`development` → `.env.dev`, `staging` → `.env.staging`,
  `ci`/`test` → `.env.ci`) e responde a um valor desconhecido com `400`
  nomeando a lista de aceitos — ele nunca cai silenciosamente para `dev`.
- **A gravação é validada e confirmada.** Apenas chaves da allowlist de
  escrita são aceitas, os valores são verificados contra os conjuntos de enum
  do Contrato 1 (valores fora do enum são rejeitados com a lista de aceitos e
  nada é escrito), a escrita é atômica (arquivo temporário, `fsync`, rename) e
  a resposta retorna o estado pós-gravação que o painel confirma
  (`Environment "staging" saved to .env.staging`).

## A prévia do ecossistema PM2 (JUM-480) — pela fonte, não pela string de comando

O painel de perfil de runtime prévia os processos PM2 sob os quais o service
kind desenhado rodaria. A propriedade mais importante dessa prévia — e a mais
provável de ser desfeita por um atalho futuro — é **de onde ela lê**:

- **A prévia lê os arquivos reais `pm2/ecosystem.*.cjs`** através de
  `GET /api/runtime/pm2-ecosystem` (Requisito 126, Contrato 1b), nunca uma
  lista de processos embutida no código. **Adicionar um app a um arquivo de
  ecossistema muda a prévia sem mudança de código e sem reinício do servidor** —
  o endpoint carrega o módulo de ecossistema com cache invalidado a cada
  leitura. A justificativa pertence ao registro escrito: no dia em que um
  contribuidor embutir uma lista literal de processos ou uma invocação de
  gerenciador de pacotes no designer, a prévia começa a mentir sobre a
  realidade, e a transição para o Bun
  ([JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun),
  [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover))
  mudará o formato de invocação por baixo dela. É por isso que o Contrato 1b
  **proíbe** qualquer string de gerenciador de pacotes (`pnpm run`, `bun run`,
  `npm run`) ou nome de script `pm2:start:*` no servidor e no designer: o
  comando relatado é *derivado da definição do ecossistema* (seu caminho e o
  nome do app), portanto permanece verdadeiro qualquer que seja o gerenciador
  de pacotes que invoque o PM2. Este documento, portanto, descreve a prévia
  pela sua fonte, não pelas strings literais de comando que ela produz hoje.
- **Estados de borda honestos, nunca um painel silenciosamente vazio.** Um
  ambiente sem arquivo de ecossistema (`ci`/`test` mapeiam para
  `ecosystem.ci.cjs`, que o repositório não define) é um estado explícito
  `exists: false` renderizado como "No PM2 ecosystem file for environment …",
  não um erro e não uma lista vazia apresentada como real. Um arquivo de
  ecossistema ilegível ou sintaticamente quebrado emerge como o envelope da
  classe 500 com `code` e `path` — paralelo à classe de sistema de arquivos
  dos env (JUM-543) — de modo que um `pm2/ecosystem.*.cjs` quebrado é
  identificável como um problema de instalação, nunca confundido com uma
  requisição malformada.
- **O ambiente da prévia é independente do ambiente de edição.** O seletor da
  prévia oferece os ambientes para os quais o repositório define ecossistemas —
  `dev`, `staging`, `production` (fixado pela suíte de contrato da UI) —
  enquanto o editor de env mira os arquivos env editáveis. Produção tem um
  ecossistema, mas nenhum arquivo env editável; o console mantém esses eixos
  separados em vez de confundi-los.
- **A filtragem é por service kind; os nomes vêm do arquivo.** O painel
  seleciona os apps do ecossistema cujos nomes terminam com os sufixos que o
  service kind desenhado implica (`restapi` para REST-only, mais
  `websocketapi` ou `grpcapi` para os kinds realtime) e sugere um único comando
  derivado cobrindo exatamente esses apps. A correspondência por sufixo funciona
  para todo prefixo de ambiente porque nenhum nome de app é enumerado no
  designer.
- **A prévia é transitória.** Ela vive em estado de UI no nível do módulo,
  nunca no payload persistido `service-management.v1` (Requisito 126,
  Contrato 2) — um retrato derivado do servidor não é estado de design.

**Comprovado por:**
[`pm2Ecosystem.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pm2Ecosystem.integration.test.ts)
(leituras do ecossistema real, edição refletida sem reinício, estado explícito
de arquivo ausente, envelope 500 honesto, rejeição explícita de ambientes
desconhecidos) e
[`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts)
(a garantia estrutural de nenhum comando embutido sobre os fontes do designer).

## Deploy Management: o contrato de metadados do Requisito 059 (JUM-481)

Todo deploy target carrega o contrato de metadados do Service Management do
Requisito 059 — `{ name, region, runtime, serviceType, deployTarget,
runtimeProtocol, databaseDriver, keyValueDriver, pm2Profile }` — fixado como
uma extensão retrocompatível do esquema de armazenamento (Requisito 126,
Contrato 2: a chave versionada permanece inalterada). As regras da aba:

- **O que um target pode conter** é de responsabilidade de
  `collectDeployTargetIssues`
  ([`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js)):
  os seis vocabulários, a linha da matriz service-type × deploy-target, a
  exposição de protocolos e a aplicabilidade do perfil PM2 — cada rejeição
  nomeia a restrição violada (a seção da matriz compartilhada acima dá as
  razões). Toda issue tem severidade `error`.
- **A lista revalida cada entrada persistida.** `renderDeployments`
  ([`inspectors.js`](../../apps/service-management/src/ui/inspectors.js)) roda
  o coletor sobre cada target armazenado e sinaliza uma entrada rejeitada
  inline com suas issues, em vez de renderizá-la como um design construível. A
  validação, portanto, é aplicada na superfície onde os targets são
  consumidos, independentemente de como a entrada chegou lá.
- **Entradas legadas migram para frente na carga, sem perdas.**
  `normalizeDeploymentInput`
  ([`designerState.js`](../../apps/service-management/src/state/designerState.js))
  migra o formato pré-JUM-481 `{ name, type, region, runtime }`: `type`
  torna-se `deployTarget` através de um mapa de aliases (`dedicated` →
  `dedicated-server`), e os metadados ausentes recebem padrões derivados da
  matriz — o primeiro service type que o target suporta, o primeiro protocolo
  desse type, os drivers padrão do contrato de ambiente de runtime e o perfil
  PM2 `dev` apenas em targets gerenciados por PM2. **Valores legados sem
  contraparte na matriz (por exemplo `azure-functions`) são mantidos
  literalmente** — a migração nunca descarta informação silenciosamente; a
  regra de vocabulário sinaliza a entrada, e o operador decide. O fato de
  `normalizeStatePayload` restaurar a seção `deployments` é a exceção do
  JUM-481 ao recorte de carga fixado.

**Comprovado por:**
[`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts)
e a cobertura de migração na carga em
[`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts).

## Ciclo de vida dos deploy targets: edição, duplicação e validação de campos (JUM-546)

A JUM-481 é dona do que um target pode conter; a JUM-546 é dona de como os
targets são gerenciados. O ciclo de vida completo da aba é **adicionar,
editar in-place, duplicar e excluir**:

- **Edição in-place.** `Edit` carrega a entrada no formulário; o botão de
  adição torna-se `Save Target` (com a opção `Cancel Edit`) e o mesmo portão
  de validação se aplica à substituição. Uma edição pode manter o próprio
  nome — a verificação de unicidade exclui a entrada que está sendo
  substituída — e excluir uma entrada no meio de uma edição cancela a edição
  (ou reposiciona o índice) em vez de sobrescrever outro target.
- **Duplicação.** `Duplicate` armazena uma **cópia profunda** independente —
  nunca uma referência compartilhada — renomeada pela regra ` (copy)`
  (`nome (copy)`, depois `nome (copy 2)`, … até ser único, comparado sem
  distinção de maiúsculas). Deploy targets são a única coisa que operadores
  criam em conjuntos quase idênticos (o mesmo serviço em staging e produção,
  a mesma configuração em várias regiões); a duplicação é a defesa primária
  contra as inconsistências de redigitação que a validação de campos teria de
  capturar.
- **Validação de campos** — `collectDeployTargetFieldIssues` em
  [`deployTargetLifecycleValidation.js`](../../apps/service-management/src/validation/deployTargetLifecycleValidation.js),
  executada no portão de adição/edição junto às regras de matriz da JUM-481:
  o nome é obrigatório e único; o runtime/version é obrigatório e deve seguir
  um padrão de nome-mais-versão (`nodejs22.x`, `python3.12` — texto livre
  como `latest` é rejeitado); a região é obrigatória em todo target de nuvem
  e opcional na linha self-hosted Dedicated Server (SSH), onde o campo pode
  carregar informação de host. O conjunto self-hosted é lido do leitor
  compartilhado da matriz (`SELF_HOSTED_DEPLOY_TARGETS` em
  [`deployCapabilityMatrix.js`](../../apps/service-management/src/model/deployCapabilityMatrix.js)),
  nunca transcrito. Toda rejeição nomeia a razão na superfície de status da
  JUM-543, e o candidato nunca toca o estado.
- **Dicas de campo por tipo de target.** A linha de dica sob o formulário
  (`deployTargetFieldHint`) acompanha a linha da matriz selecionada: targets
  gerenciados por PM2 (linhas VM/dedicado) são orientados à informação de
  host e ao perfil PM2; provedores de funções, ao runtime/version, com o
  select de perfil PM2 desabilitado e limpo — perfil PM2 não se aplica.

**Comprovado por:**
[`deployTargetLifecycle.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetLifecycle.test.ts)
(as regras como funções puras) e
[`deployTargetLifecycle.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/deployTargetLifecycle.browser.integration.test.ts)
(a UI real em WebKit: adição validada, razões de rejeição na região de
status, a regra de renomeação ` (copy)`, independência da edição in-place, a
regra de região por tipo e o comportamento da dica e do select de PM2).

## Regras de ciclo de vida — o que existe hoje e o que está aberto

A cadeia de issues reserva o ciclo de vida completo (edição in-place,
duplicação, validação em nível de campo, unicidade) das duas listas do console
para
[JUM-545](https://linear.app/jumentix/issue/JUM-545/feature-interface-adapter-lifecycle-edit-in-place-uniqueness-and)
(interface adapters) e
[JUM-546](https://linear.app/jumentix/issue/JUM-546/feature-deploy-target-lifecycle-edit-duplicate-and-field-validation)
(deploy targets). **A JUM-546 foi entregue** (a seção acima); a JUM-545
continua aberta — esta seção registra o ciclo de vida que o código realmente
implementa hoje, para que a lacuna restante seja legível em vez de descoberta
clicando.

**Interface adapters (Communication Interface Designer).** Hoje um adapter é
**adicionado** e **excluído** — nada mais. O portão de adição
(`script.js`) exige que framework/runtime, entrypoint e o mapeamento de
controller estejam todos presentes antes de a entrada `{ type, framework,
entrypoint, controller }` ser armazenada; não há edição in-place, não há
duplicação e não há restrição de unicidade — dois adapters idênticos podem ser
registrados. A JUM-545 é dona das regras que faltam, incluindo as restrições
de unicidade e suas razões.

**Deploy targets (Deploy Management).** O ciclo de vida completo foi entregue
com a JUM-546 — **adicionar, editar in-place, duplicar e excluir**, com
validação em nível de campo (nome único, padrão de runtime/version, região
por tipo de target) no portão de adição/edição e a regra de renomeação
` (copy)` nas duplicações. Ver a seção da JUM-546 acima.

A razão de esta seção de lacuna honesta existir: as listas do console são as
superfícies onde um design se torna uma intenção operacional, e uma entrada
que só *se torna* válida após um reload — ou um adapter duplicado que nada
rejeita — é uma regra que o usuário não consegue ver. Nomear as issues
responsáveis mantém a regra visível até o código alcançá-la.

## O contrato de superfície de status que toda superfície do console segue (JUM-543)

O console nunca bloqueia para dar feedback. A JUM-543 substituiu todos os
`window.alert` por **superfícies de status não bloqueantes**, e cada painel do
console segue o mesmo modelo:

- **Uma única região de toast aria-live** (`#status-region`, `role="status"`,
  `aria-live="polite"`) anuncia mensagens de validação e falhas de API;
  avisos de severidade info se ocultam automaticamente, erros persistem. Os
  portões de ações destrutivas mantêm deliberadamente seu `window.confirm` —
  um toast não substitui um portão.
- **Linhas de status inline por painel** — o status da prévia do PM2, o status
  do Service Configuration, o status do ambiente de runtime e a linha de
  direcionamento por arquivo — carregam falhas *com ambiente, arquivo e causa*
  onde o usuário está olhando, em vez de um erro silencioso no console.
- **O cliente renderiza o envelope de erro da API literalmente.** `error` /
  `details`, mais `code` e `path` nas classes 500 de sistema de arquivos, são
  exibidos exatamente como retornados — não há remapeamento de erro no lado do
  cliente, de modo que a separação parse/validação/sistema de arquivos
  documentada no Requisito 126 chega intacta ao usuário.

## O que este documento deliberadamente não cobre

- **Persistência e comportamento de boot** — a porta `IDesignerStore` e a
  migração para o Cana já entregue
  ([JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to))
  pertencem ao
  [documento E3](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md), e suas
  promessas ao usuário ao
  [documento E6](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md).
- **Exportação/importação das abas do console** — as seções `interfaces`,
  `serviceConfiguration` e `runtimeEnvironment` não cruzam nenhum caminho de
  exportação hoje; o documento E4 nomeia esse limite e sua issue responsável
  ([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration))
  em
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md).
- **O formato literal de invocação do PM2** — fixado pelo Requisito 126,
  Contrato 1b, e com mudança prevista na transição para o Bun
  ([JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun),
  [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover));
  a prévia é documentada pela sua fonte precisamente para que este documento
  sobreviva a essa transição.

## Referências

- Leitor compartilhado da matriz: [`deployCapabilityMatrix.js`](../../apps/service-management/src/model/deployCapabilityMatrix.js); documentos de matriz: [Matriz de deploy target e empacotamento](./JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.pt-BR.md), [Matriz de capacidades da service factory](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md)
- Validadores: [`serviceConfigurationValidation.js`](../../apps/service-management/src/validation/serviceConfigurationValidation.js), [`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js), [`deployTargetLifecycleValidation.js`](../../apps/service-management/src/validation/deployTargetLifecycleValidation.js)
- Endpoints do servidor: [`server.js`](../../apps/service-management/server.js); cola da UI: [`script.js`](../../apps/service-management/script.js), [`inspectors.js`](../../apps/service-management/src/ui/inspectors.js), estado/migração: [`designerState.js`](../../apps/service-management/src/state/designerState.js)
- Fontes de ecossistema: [`pm2/ecosystem.dev.cjs`](../../pm2/ecosystem.dev.cjs), [`pm2/ecosystem.staging.cjs`](../../pm2/ecosystem.staging.cjs), [`pm2/ecosystem.production.cjs`](../../pm2/ecosystem.production.cjs)
- Suítes: [`serviceConfigurationValidation.test.ts`](../../apps/backend-template/test/unit/service-management/serviceConfigurationValidation.test.ts), [`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts), [`deployTargetLifecycle.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetLifecycle.test.ts), [`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts), [`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts), [`runtimeEnvUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/runtimeEnvUi.contract.test.ts), [`pm2Ecosystem.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pm2Ecosystem.integration.test.ts), [`runtimeEnv.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/runtimeEnv.integration.test.ts), [`runtimeEnvContract.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/runtimeEnvContract.integration.test.ts), [`deployTargetLifecycle.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/deployTargetLifecycle.browser.integration.test.ts)
- Requisitos: [126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md) (Contratos 1, 1b e 2), [059](../../.agents/requirements/software/059-jumentix-service-factory-and-deploy-template-matrices.md) (as matrizes de deploy e da factory), [076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md) (paridade EN/PT)
- Documentos irmãos da cadeia E: [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md) (E1), [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md) (E3), [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md) (E4), [Aplicativo Service Management](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md), [Funcionalidades e uso do Domain Designer](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.pt-BR.md)
- Linear: [JUM-480](https://linear.app/jumentix/issue/JUM-480/feature-real-multi-environment-editing-and-pm2-ecosystem-preview), [JUM-481](https://linear.app/jumentix/issue/JUM-481/feature-deploy-management-aligned-to-req-059-matrix-with-per-service), [JUM-543](https://linear.app/jumentix/issue/JUM-543/fix-replace-blocking-alerts-with-non-blocking-status-surfaces-and), [JUM-544](https://linear.app/jumentix/issue/JUM-544/fix-service-configuration-validation-port-conflicts-and-run-mode), [JUM-545](https://linear.app/jumentix/issue/JUM-545/feature-interface-adapter-lifecycle-edit-in-place-uniqueness-and), [JUM-546](https://linear.app/jumentix/issue/JUM-546/feature-deploy-target-lifecycle-edit-duplicate-and-field-validation), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration), [JUM-464](https://linear.app/jumentix/issue/JUM-464/docs-e1-documentation-enpt-runtime-env-contract-and-fixed-paths), [JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun), [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover)
