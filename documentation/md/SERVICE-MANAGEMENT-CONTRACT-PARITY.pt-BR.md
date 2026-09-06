<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-CONTRACT-PARITY.md
Idioma alvo: Português (Brasil)
-->
# Garantias de paridade de contratos do Service Management

Este é o documento E4 da cadeia de documentação E1–E8 do Service Management
([JUM-479](https://linear.app/jumentix/issue/JUM-479/docs-e4-documentation-contract-parity-guarantees)).
Ele documenta o que as exportações de contrato do designer **garantem** —
exatamente como o código se comporta hoje, após a entrega da frente de
paridade de contratos
([JUM-474](https://linear.app/jumentix/issue/JUM-474/feature-oas-31-export-compliant-with-req-036-and-route-resolution),
[JUM-475](https://linear.app/jumentix/issue/JUM-475/feature-asyncapi-and-proto-exports-targeting-canonical-specasyncapi),
[JUM-476](https://linear.app/jumentix/issue/JUM-476/feature-codegen-preview-and-boilerplate-bundle-emit-hexagonal-layout),
[JUM-477](https://linear.app/jumentix/issue/JUM-477/feature-rbac-editor-aligned-to-tenant-rbac-authorization-contract),
[JUM-478](https://linear.app/jumentix/issue/JUM-478/feature-lossless-round-trip-import-of-spec100yml-with-full-meta))
e de sua maquinaria de verificação
([JUM-470](https://linear.app/jumentix/issue/JUM-470),
[JUM-471](https://linear.app/jumentix/issue/JUM-471/test-bun-unit-suite-exportersimporters-round-trip)).

A garantia é uma promessa ao boilerplate, não uma lista de funcionalidades:
**um artefato exportado do designer pode ser consumido pelo boilerplate sem
edição manual.** Cada garantia abaixo nomeia a verificação que a comprova,
para que o leitor possa verificar em vez de confiar — e para que um mantenedor
que quebre uma delas reprove uma suíte, e não uma opinião em revisão.

A superfície de exportação em si (oito exportadores, seus formatos e o portão
de qualidade de exportação) está fixada no
[Requisito 126, Contrato 3](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
— este documento aponta para ele em vez de duplicá-lo. Os passo a passo de uso
estão em
[Funcionalidades e uso do Domain Designer](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.pt-BR.md)
(seções 10.1–10.2).

## Garantia 1 — a exportação OAS 3.1 é consumível pelo boilerplate (JUM-474)

Construtor: `buildOasDocument` em
[`packages/designer-core/src/exporters/designerExporters.js`](../../packages/designer-core/src/exporters/designerExporters.js).

**O documento declara `openapi: '3.1.0'` — 3.1, não 3.0 — porque essa é a
versão que o boilerplate consome.** O
[`spec/1.0.0.yml`](../../spec/1.0.0.yml) canônico declara `3.1.0`, e o modelo
de entidades é legislado em OpenAPI 3.1 de ponta a ponta pelo
[Requisito 026](../../.agents/requirements/software/026-openapi31-data-entity-model-compliance.md)
(3.1 é a linha alinhada ao JSON Schema 2020-12; a exportação JSON Schema do
designer mira o mesmo draft). Uma exportação que correspondesse à sintaxe da
versão canônica, mas não à sua versão, seria um contrato que o consumidor
teria que traduzir — por isso a exportação emite exatamente o dialeto que os
portões do boilerplate já validam.

É garantido que o documento exportado satisfaz o
[Requisito 036](../../.agents/requirements/software/036-openapi-port-objects-contracts.md),
a disciplina de objetos de porta aplicada ao spec canônico por
[`ci-cd/check-oas-route-resolution.js`](../../ci-cd/check-oas-route-resolution.js):

- **`operationId`s de verbos canônicos.** Toda operação carrega um
  `operationId` no esquema de verbos canônico (`getAll*` / `create*` /
  `get*ById` / `update*` / `delete*`), qualificado pelo nome do schema para
  que os ids permaneçam únicos entre domínios (`getAllBilling_Invoice`).
- **A disciplina de `$ref`.** Corpos de requisição referenciam os objetos de
  porta de entrada `RequestCreate<Schema>` / `RequestUpdate<Schema>` via
  `$ref`; toda resposta 2xx referencia o schema da entidade, seu wrapper
  `<Schema>ArrayOf` ou o `ResourceDeleteResponse` compartilhado — nunca um
  schema inline. Todo schema referenciado carrega uma `description` não vazia.
- **Códigos de erro canônicos.** As respostas de erro usam o conjunto de
  status de
  [ERROR-CONTRACTS-AND-RESPONSES](./ERROR-CONTRACTS-AND-RESPONSES.pt-BR.md)
  (400/401/403/404/409) com suas descrições canônicas.
- **Os wrappers de porta são marcados, não escondidos.** Os wrappers derivados
  de entrada/saída de porta carregam `'x-port-object': true`, o que permite ao
  importador OAS ignorá-los (ver Garantia 4).

**Comprovado por:**
[`designerOasCompliance.test.ts`](../../apps/backend-template/test/unit/service-management/designerOasCompliance.test.ts),
que importa `validatePortObjectContracts` e `resolveSchemaByRef` **do
verificador real** (não de uma cópia) e os aplica a um documento exportado de
um modelo no estilo da UI — a exportação não pode divergir do portão sem
reprovar a suíte. A metade da garantia referente a colisões de nomes (dois
nomes que tokenizam para o mesmo schema/rota, por exemplo `Foo Bar` vs
`Foo-Bar`, são erros que bloqueiam o portão de exportação em vez de sobrescritas
silenciosas) vive em
[`modelValidation.js`](../../packages/designer-core/src/validation/modelValidation.js)
e é fixada por
[`modelValidation.test.ts`](../../apps/backend-template/test/unit/service-management/modelValidation.test.ts).

## Garantia 2 — AsyncAPI 3.0 por transporte e um proto canônico (JUM-475)

Construtores:
[`packages/designer-core/src/exporters/asyncApiExporters.js`](../../packages/designer-core/src/exporters/asyncApiExporters.js).

- **Um arquivo por transporte, nomenclatura canônica.** A exportação emite
  `<version>.websocket.yml` e `<version>.grpc.yml`, correspondendo um a um ao
  diretório [`spec/asyncapi/`](../../spec/asyncapi/1.0.0.websocket.yml) —
  nunca um documento combinado único, nunca o formato publish/subscribe 2.x.
  No 3.0, os canais carregam `messages` e o mapa `operations` de topo carrega
  `action: send|receive` (contratos `response` são recebidos; todo outro tipo
  é enviado), além de `$ref`s de canal/mensagem.
- **A mesma disciplina de `$ref` de payloads do OAS.** Os payloads de
  mensagem vivem uma única vez sob `components.schemas` e as mensagens os
  referenciam — payloads idênticos compartilham uma única entrada de schema
  em vez de serem inline por mensagem.
- **Todo documento exportado valida contra**
  `validateAsyncApi30Document`
  ([`asyncApi30Validation.js`](../../packages/designer-core/src/validation/asyncApi30Validation.js)),
  o validador estrutural interno para o formato 3.0 (o repositório não depende
  de `@asyncapi/parser`). Os arquivos canônicos de `spec/asyncapi/` passam
  pelas mesmas regras — paridade de formato drop-in entre o que o designer
  emite e o que o boilerplate entrega.
- **A exportação proto gRPC reproduz o envelope canônico.** proto3, pacote
  `realtime`, serviço `AsyncApiGateway`, mensagens de envelope
  `AsyncApiRequest`/`AsyncApiResponse`, um par rpc/mensagem por contrato de
  mensagem do designer. Para um modelo sem contratos, o proto emitido é
  **byte a byte idêntico** ao
  [`spec/asyncapi/async-api.proto`](../../spec/asyncapi/async-api.proto)
  versionado.

**Comprovado por:**
[`designerAsyncApiExport.test.ts`](../../apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts)
— incluindo a asserção de identidade byte a byte e o teste que executa o
validador sobre os próprios arquivos canônicos, de modo que os documentos
canônicos e a exportação divergem juntos ou reprovam juntos.

## Garantia 3 — o bundle de codegen é código entregável (JUM-476)

Construtor:
[`packages/designer-core/src/codegen/hexagonalCodegen.js`](../../packages/designer-core/src/codegen/hexagonalCodegen.js),
consumido tanto pelo exportador de bundle de boilerplate
(`buildBoilerplateBundleDocument`, artefato `kind: 'boilerplate-bundle'`,
`version: '2.0.0'`) quanto pelo painel Code Preview do designer — mesmo
construtor, então preview e bundle não podem divergir.

- **O layout é hexagonal e espelha o módulo Users migrado**
  (`src/modules/<Domain>/` com `domain/{Entity,Model,security}`,
  `application/{ports,use-cases}`, `adapters/in/http/controllers`,
  `adapters/out/persistence`, `composition/` e `events/contracts/` apenas
  quando existem contratos de mensagem — ver
  [HEXAGONAL-FEATURE-DRIVEN-MIGRATION](./HEXAGONAL-FEATURE-DRIVEN-MIGRATION.pt-BR.md)).
- **Os formatos de contrato são consumidos, nunca rederivados.** Os tipos de
  campo vêm dos schemas de componente OAS da Garantia 1, as rotas HTTP de seus
  paths e `operationId`s, e os canais de evento dos canais AsyncAPI da
  Garantia 2. Uma mudança de contrato regenera o código; o código nunca
  bifurca o contrato.
- **A saída passa nas verificações de arquitetura do próprio repositório.**
  Todo controller gerado passa no `validateControllerFile` de
  [`ci-cd/check-hexagonal-boundaries.js`](../../ci-cd/check-hexagonal-boundaries.js),
  e o grafo de imports gerado aponta apenas para dentro (domain ← application
  ← adapters ← composition).
- **A saída compila.** O conjunto de arquivos emitido compila sob
  `tsc --strict` — a suíte grava o bundle em um diretório temporário e executa
  o compilador real sobre ele.

**O que a pessoa desenvolvedora ainda escreve.** O bundle é um esqueleto
executável, não um serviço: o adaptador de persistência é um espelho em
memória (`Map`) de `UserDataRepository.ts` que você substitui pelo cliente de
armazenamento real, a raiz de composição precisa ser conectada ao bootstrap do
serviço, e qualquer regra de negócio além dos verbos CRUD canônicos é sua. A
garantia cobre a fronteira — layout, contratos, compilação, verificações de
arquitetura — não a lógica de aplicação.

**Comprovado por:**
[`hexagonalCodegen.test.ts`](../../apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts).

## Garantia 4 — fidelidade de ida e volta, com as fronteiras honestas (JUM-471, JUM-478)

Suíte:
[`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts).
A propriedade sob teste é a própria travessia — exportar → importar →
comparar — de modo que um cancelamento do tipo exportador-omite-campo +
importador-ignora-campo não consiga se esconder atrás de saídas fixas
esperadas.

### Travessias simétricas (sem perdas, deep-equal assertado)

- **JSON** (`buildJsonExportDocument` → `buildStateFromSuiteExport` sobre
  `normalizeStatePayload`): o documento versionado de suíte completa
  (JUM-547/JUM-736) — `domains`, `relationships`, `view`, `interfaces`,
  `serviceConfiguration`, `codeWorkspace` e `deployments` fazem ida e volta com deep-equal, e
  a exportação é idempotente. A fronteira é documentada e assertada: seleções
  e `idCounter` não fazem parte do documento e são recomputados na
  importação, e `runtimeEnvironment` atravessa apenas como a *seleção* de
  ambiente (veja a seção JUM-547 abaixo). Documentos anteriores ao JUM-547,
  só de domínio (`{ domains, relationships, view }`, sem `kind`/`version`),
  importam normalmente com as seções ausentes preenchidas com padrões; um
  documento com seção desconhecida no nível raiz, `version` major mais recente
  ou `kind` diferente de `service-management-suite` falha claramente em vez
  de importar pela metade.
- **Pacote de domínio** (`buildDomainPackageDocument` → `buildDomainFromPackage`):
  um pacote faz ida e volta com deep-equal em um modelo vazio, carimbado com
  proveniência (JUM-492): o documento v2 carrega um bloco `package`
  (`{ name, version, dependencies }`), e o conteúdo importado registra
  `context.provenance`/`meta.provenance` (`{ package, version }`).
  Reimportações são conscientes de versão: a mesma versão com conteúdo igual
  é no-op, a mesma versão com conteúdo diferente e downgrades são recusados,
  e uma versão mais nova faz merge determinístico — mudanças aditivas e de
  metadados são aplicadas, e remoções, estreitamentos, RBAC e invariantes
  mantêm o conteúdo existente e são listados na prévia de merge para decisão
  do usuário (Requirement 126 Contrato 3). Faixas de versão de dependências
  são resolvidas contra o registro de pacotes instalados; dependências
  ausentes ou incompatíveis são reportadas, e um ciclo que o pacote de
  entrada fecharia é recusado. A recomputação de ids do JUM-617 continua
  guardando o caminho de anexação (um pacote diferente com ids colidindo).

### A travessia OAS: ponto fixo, lista de perdas vazia

O OAS é mais estreito que o modelo interno, então a travessia OAS era a com
perdas. O JUM-478 reduziu a lista de perdas em nível de modelo **de 21
caminhos de diff para zero**, e a suíte asserta a lista vazia exata — um campo
entrando (ou voltando) silenciosamente para ela reprova a suíte:

- **Exportar → importar → exportar alcança um ponto fixo**; o diff de
  documento da primeira travessia é exatamente `[]` (assertado com
  `toStrictEqual`, não inspecionado visualmente).
- O que o OAS não consegue expressar nativamente atravessa como extensões
  `x-` acordadas que o importador normaliza de volta para `entity.meta`:
  `x-aggregate-root`, `x-invariants`, `x-rbac` (emitido apenas quando a
  política diverge do padrão do designer — um `x-rbac` ausente normaliza de
  volta para exatamente esse padrão), `x-fieldless: true` (um conjunto de
  campos vazio sobrevive em vez de ganhar os campos padrão
  `id`/`createdAt`/`updatedAt` do importador) e `x-field-flags: { pk, fk,
  unique }` por campo (emitido apenas quando os flags divergem da heurística
  de nomes do importador: `id` → PK/unique, `*Id` → FK). Contratos de mensagem
  e composição (`oneOf`/`allOf`/`anyOf`, `discriminator`, `x-external-refs`)
  atravessam da mesma forma.
- **Relacionamentos atravessam como linhas `x-relations` de topo indexadas
  por nome de schema** (`{ name, fromSchema, toSchema, fromCardinality,
  toCardinality }`) — nunca por id de modelo, porque o importador recomputa
  ids e ids no documento quebrariam o ponto fixo. Linhas cujos pontos de
  extremidade não importaram são descartadas, a mesma regra que
  `normalizeStatePayload` aplica a ids de modelo pendentes.
- **Os wrappers de objeto de porta são ignorados por design — e isso não é
  uma perda.** `RequestCreate*`/`RequestUpdate*`/`*ArrayOf`/
  `ResourceDeleteResponse` são artefatos derivados, não estado do modelo;
  reimportá-los fabricaria entidades fantasma. Documentos exportados pelo
  designer os marcam com `'x-port-object': true`.

### As fronteiras que permanecem (nomeadas, assertadas, não varridas para debaixo do tapete)

Para **documentos exportados pelo designer**, a travessia em nível de modelo
ainda não carrega, por design:

- **Blocos de bounded context de domínio** (`domain.context`) e **layout do
  canvas** (posições, cores) — não têm transporte por extensão; a importação
  os recomputa. Os **nomes** de domínio e entidade sobrevivem.
- **A normalização de formato tipado**: campos tipados (`uuid`/`date`/
  `datetime`) retornam carregando o formato canônico que o exportador derivou
  do tipo. A suíte asserta isso como a transformação
  `applyDocumentedOasFormatNormalization`, de modo que é parte do contrato,
  não um acidente.
- **Estado de view** (zoom, filtros, o toggle do portão de exportação) é
  conteúdo da exportação JSON, não do OAS — o importador OAS nunca o
  restaurou.

Para **documentos estrangeiros** — arquivos OAS que o designer não emitiu,
como o [`spec/1.0.0.yml`](../../spec/1.0.0.yml) canônico — o importador
reconhece objetos de porta por convenção (as mesmas regras de
nomeação/descrição: `Request*`, `*ArrayOf`, `ResourceDeleteResponse`,
descrições "Port input/output object" que não são contratos de entidade
`<Name> resource`, e schemas não-objeto), e as perdas remanescentes nomeadas
são:

- as **facetas `example` / `default` / `minItems` / `maxItems`** — o modelo
  de campos do designer não tem espaço para elas;
- **vinculações `$ref` de itens de array** — referências a objetos de valor
  são achatadas para o vocabulário `itemsType`;
- **`operationId`s legados (não canônicos)** — a importação não preserva
  operationIds, então a reexportação os regenera no esquema de verbos
  canônico.

A própria importação canônica está fixada: o `spec/1.0.0.yml` (OpenAPI 3.1.0,
33 operationIds) importa como um domínio `Imported` com exatamente os seis
schemas de contrato (`Document`, `Email`, `Address`, `Phone`, `User`,
`Organization`) — sem entidades fantasma de objetos de porta, sem
relacionamentos — com normalização completa de meta, e reexporta para um
ponto fixo cujos schemas de entidade mantêm as propriedades e os conjuntos de
obrigatórios da origem, e cujos paths carregam as cinco operações CRUD
canônicas por schema.

### Exportadores de mão única

Markdown, JSON Schema, AsyncAPI e o bundle de boilerplate não têm importador.
Suas suítes assertam invariantes estruturais em vez de uma travessia: todo
domínio/entidade/campo/relacionamento é renderizado; uma definição JSON Schema
por entidade com `required ⊆ properties` e `additionalProperties: false`; uma
operação AsyncAPI 3.0 por contrato por transporte com refs de payload
compartilhados; um módulo de bundle por domínio com o conjunto de arquivos
hexagonal.

## Onde os portões aplicam tudo isso

- **O portão de qualidade de exportação** (Requisito 126, Contrato 3): com
  `view.exportBlockCritical` verdadeiro (o padrão), todo exportador se recusa
  a executar enquanto
  [`collectModelIssues`](../../packages/designer-core/src/validation/modelValidation.js)
  reportar qualquer problema de severidade `error` — o que inclui a regra de
  colisão de nomes OAS e papéis RBAC não aplicáveis (ver abaixo). A metade DOM
  do portão é `canExportModel` em
  [`apps/service-management/script.js`](../../apps/service-management/script.js).
- **As suítes de unidade são a aplicação.** Todas as suítes nomeadas acima
  rodam sob Bun pelo executor mapeado
  ([`ci-cd/run-unit-tests.js`](../../ci-cd/run-unit-tests.js), que recusa uma
  execução que descobre zero testes) dentro de `bun run test:unit` — uma célula
  de todo portão de qualidade de branch (`ci-cd/run-branch-quality-gate.js` a
  seleciona para pushes diretos em `dev`, e a matriz completa para pull
  requests em `dev` e `main`).
- **Os portões do spec canônico permanecem verdes no lado do boilerplate**:
  `bun run oas:check-routes` (Req 036 sobre `spec/`) e
  `bun run arch:check-boundaries` são células do `ci:gate`, de modo que um
  contrato canônico que o designer mira não pode silenciosamente deixar de ser
  aquilo contra o qual a exportação foi moldada.

## Alinhamento RBAC e a divergência que ele reconciliou (JUM-477)

O editor RBAC por entidade está alinhado ao
[Contrato de autorização de tenant e RBAC](./TENANT-RBAC-AUTHORIZATION-CONTRACT.pt-BR.md)
através de
[`src/model/rbacContract.js`](../../packages/designer-core/src/model/rbacContract.js),
um espelho no lado do designer da implementação do domínio Users (`Rbac.ts`,
`TenantAuthorizationPolicy.ts`). A reconciliação encontrou uma divergência
real, registrada aqui em vez de corrigida silenciosamente:

- **O designer persistia `tenantScoped` como um flag livre por regra; o
  runtime não tem esse controle.** O escopo de tenant no runtime é *derivado*
  do conjunto de papéis (`shouldRequireOrganization`: papéis normalizados
  `admin`/`user` restringem o principal à sua organização; `superadmin` e
  escopos diretos legados mantêm uma fronteira global). Um valor
  `tenantScoped` armazenado que contradissesse os papéis era uma configuração
  que o boilerplate silenciosamente não honraria. O editor agora deriva
  `tenantScoped` dos papéis selecionados (a caixa de seleção é somente leitura
  e pré-visualiza o valor derivado), e as políticas armazenadas são reparadas
  para o valor derivado no carregamento — uma extensão compatível sob o
  Requisito 126 Contrato 2, com o formato armazenado inalterado.
- **O vocabulário de principais é fechado.** Apenas os papéis de tenant
  normalizados (`superadmin`, `admin`, `user`) e os escopos diretos legados
  são aplicáveis; qualquer outra coisa é rejeitada em tempo de edição e
  reportada como `error` pela validação de modelo, de modo que o portão de
  exportação a bloqueia em vez de exportar uma política que o runtime
  descartaria.

**Comprovado por:**
[`rbacContract.test.ts`](../../apps/backend-template/test/unit/service-management/rbacContract.test.ts),
que fixa o espelho contra o próprio `Rbac.ts` — se o vocabulário do domínio
divergir, a suíte reprova. É também por isso que o `x-rbac` faz ida e volta
sem perdas (Garantia 4): a política exportada é a normalizada e aplicável, e
o importador a reconstrói contra o mesmo contrato.

## Exportação de suíte completa e a decisão sobre `runtimeEnvironment` (JUM-547, entregue)

Exportação e importação agora carregam **as cinco abas**, não apenas o
modelo de domínio. A exportação JSON (`domain-designer.json`) é o documento
versionado de suíte completa: `{ kind: "service-management-suite",
version: "2.0.0", domains, relationships, interfaces, serviceConfiguration,
runtimeEnvironment, codeWorkspace, deployments, view }` — as mesmas seções que o documento
fixado `service-management.v1` persiste no Cana (Requisito 126, Contrato 2),
menos as seleções de sessão e o `idCounter`. Um modelo desenhado nas cinco
abas exporta e reimporta com todas as abas intactas; um bundle exportado
antes desta mudança (o formato só de domínio, sem `kind`/`version`) importa
normalmente com as seções ausentes preenchidas com padrões, e um bundle com
seção desconhecida ou versão major mais recente falha claramente em vez de
ter sucesso parcial.

A decisão registrada é o tratamento de `runtimeEnvironment`
([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration),
Requisito 126 Contrato 3): ele espelha conteúdo real de `.env`, então um
bundle de exportação contendo os valores **seria um arquivo que pode carregar
configuração para fora da máquina**. Das três posições candidatas — exportar
apenas a seleção; exportar valores restritos à camada editável; omitir a
seção inteiramente — a postura entregue é a primeira: **o bundle carrega a
seleção de ambiente (`environment`, `fileName`), mas nunca os `values`**, e a
importação restaura a seleção preservando os valores da máquina local. O
ambiente de runtime é uma propriedade de onde o designer está rodando; a
seleção é metadado de design que vale compartilhar. Como nenhum valor
atravessa, **nenhum segredo pode sair em um bundle** — a garantia pela qual a
terceira posição era preferida, mantida sem perder a seleção. A suíte prova
isso assertando que o documento no fio não contém nenhuma string de valor.

**Comprovado por:**
[`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts)
(deep-equal de suíte completa, valores-nunca-atravessam, compatibilidade
retroativa/para frente) e
[`designerExporters.test.ts`](../../apps/backend-template/test/unit/service-management/designerExporters.test.ts)
(formato do documento).

## Referências

- Exportador/importador OAS: [`designerExporters.js`](../../packages/designer-core/src/exporters/designerExporters.js), [`designerImporters.js`](../../packages/designer-core/src/importers/designerImporters.js)
- Exportadores AsyncAPI/proto: [`asyncApiExporters.js`](../../packages/designer-core/src/exporters/asyncApiExporters.js); validador: [`asyncApi30Validation.js`](../../packages/designer-core/src/validation/asyncApi30Validation.js)
- Codegen: [`hexagonalCodegen.js`](../../packages/designer-core/src/codegen/hexagonalCodegen.js)
- Validação de modelo / portão de exportação: [`modelValidation.js`](../../packages/designer-core/src/validation/modelValidation.js), [`script.js`](../../apps/service-management/script.js)
- Espelho RBAC: [`rbacContract.js`](../../packages/designer-core/src/model/rbacContract.js); contrato: [Contrato de autorização de tenant e RBAC](./TENANT-RBAC-AUTHORIZATION-CONTRACT.pt-BR.md)
- Suítes: [`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts), [`designerPackageVersioning.test.ts`](../../apps/backend-template/test/unit/service-management/designerPackageVersioning.test.ts), [`designerOasCompliance.test.ts`](../../apps/backend-template/test/unit/service-management/designerOasCompliance.test.ts), [`designerAsyncApiExport.test.ts`](../../apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts), [`hexagonalCodegen.test.ts`](../../apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts), [`rbacContract.test.ts`](../../apps/backend-template/test/unit/service-management/rbacContract.test.ts), [`modelValidation.test.ts`](../../apps/backend-template/test/unit/service-management/modelValidation.test.ts)
- Portões: [`check-oas-route-resolution.js`](../../ci-cd/check-oas-route-resolution.js), [`check-hexagonal-boundaries.js`](../../ci-cd/check-hexagonal-boundaries.js), [`run-unit-tests.js`](../../ci-cd/run-unit-tests.js)
- Alvos canônicos: [`spec/1.0.0.yml`](../../spec/1.0.0.yml), [`spec/asyncapi/1.0.0.websocket.yml`](../../spec/asyncapi/1.0.0.websocket.yml), [`spec/asyncapi/1.0.0.grpc.yml`](../../spec/asyncapi/1.0.0.grpc.yml), [`spec/asyncapi/async-api.proto`](../../spec/asyncapi/async-api.proto)
- Requisitos: [036](../../.agents/requirements/software/036-openapi-port-objects-contracts.md) (objetos de porta), [026](../../.agents/requirements/software/026-openapi31-data-entity-model-compliance.md) (conformidade de entidades OAS 3.1), [126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md) (ownership e contratos públicos, Contratos 2–3)
- Documentos irmãos da cadeia E: [Aplicação Service Management](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md), [Arquitetura de módulos do Service Management e contrato da porta IDesignerStore](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md), [Funcionalidades e uso do Domain Designer](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.pt-BR.md)
- Linear: [JUM-474](https://linear.app/jumentix/issue/JUM-474/feature-oas-31-export-compliant-with-req-036-and-route-resolution), [JUM-475](https://linear.app/jumentix/issue/JUM-475/feature-asyncapi-and-proto-exports-targeting-canonical-specasyncapi), [JUM-476](https://linear.app/jumentix/issue/JUM-476/feature-codegen-preview-and-boilerplate-bundle-emit-hexagonal-layout), [JUM-477](https://linear.app/jumentix/issue/JUM-477/feature-rbac-editor-aligned-to-tenant-rbac-authorization-contract), [JUM-478](https://linear.app/jumentix/issue/JUM-478/feature-lossless-round-trip-import-of-spec100yml-with-full-meta), [JUM-470](https://linear.app/jumentix/issue/JUM-470), [JUM-471](https://linear.app/jumentix/issue/JUM-471/test-bun-unit-suite-exportersimporters-round-trip), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration), [JUM-492](https://linear.app/jumentix/issue/JUM-492/feature-domain-package-versioning-with-semantic-conflict-resolution)
