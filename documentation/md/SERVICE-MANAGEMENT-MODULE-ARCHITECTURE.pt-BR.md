<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md
Idioma alvo: Português (Brasil)
-->
# Arquitetura de módulos do Service Management e contrato da porta IDesignerStore

Este é o documento E3 da cadeia de documentação E1–E8 do Service Management
([JUM-473](https://linear.app/jumentix/issue/JUM-473/docs-e3-documentation-module-architecture-and-storage-port-contract)).
Ele documenta duas coisas, exatamente como o código se comporta hoje:

1. A arquitetura de módulos de `apps/service-management` conforme entregue por
   [JUM-468](https://linear.app/jumentix/issue/JUM-468/refactor-extract-statepersistence-core-as-es-module-behind)
   (mergeado no PR #86).
2. O contrato da porta de armazenamento `IDesignerStore` — com precisão
   suficiente para que um novo adaptador possa ser implementado apenas a partir
   deste documento.

Cada afirmação comportamental abaixo é garantida pelos módulos-fonte e pelas
suítes de unidade
[`designerStore.test.ts`](../../apps/backend-template/test/unit/service-management/designerStore.test.ts)
e
[`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts).

## Público

A maior parte da cadeia E documenta o componente para seus mantenedores. Este
documento também tem dois leitores externos que precisam dele antes que seu
próprio trabalho comece:

- **O `CanaDesignerStore` de H3**
  ([JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client))
  implementa `IDesignerStore` sobre o cliente Cana. Quem o escreve precisa da
  semântica exata da porta: o que `load()` retorna quando nada está
  armazenado, o que `save()` garante sobre durabilidade e como a porta expressa
  "armazenamento indisponível" e "armazenamento perdido". Esses estados existem
  na porta precisamente porque o Cana os produzirá (Cana
  [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy)
  — política de cota, persistência e despejo de armazenamento).
- **[JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry)**
  publica o núcleo do designer como um pacote `@jumentix`. As fronteiras de
  módulo de um pacote publicado são sua API pública, portanto este documento é
  a referência que um consumidor externo lê.

## Arquitetura de módulos (pós-PR #86)

A aplicação é uma SPA vanilla sem build. O `index.html` carrega `script.js`
como um módulo ES; todo o resto é alcançado por imports estáticos.

### A convenção de camadas

A arquitetura é uma única regra: **a lógica pura vive em módulos livres de
DOM; o acesso ao DOM vive no módulo de entrada.** O conjunto livre de DOM é o
que pode ser testado em unidade sob Bun/Node sem shim de DOM — e, desde o
JUM-493, sua casa canônica é o pacote publicável: os módulos do núcleo
(state, model, validation, exporters, importers, packages, codegen e a porta
`IDesignerStore`) vivem em `packages/designer-core/src/`, enquanto o `src/`
da própria app guarda a cola de DOM e os adaptadores Cana. A SPA consome o
pacote por especificadores `@jumentix/designer-core/…` (import map → árvore
vendored no navegador; tsconfig paths / mapper do Jest nos testes). A
fronteira é garantida por prova nos dois lados: o `dom-free.test.ts` varre a
AST do pacote construído em busca de globais de DOM, e as suítes unitárias do
designer exercem os fontes canônicos diretamente. O conjunto cresceu com cada
extração e entrega de store; a regra não.

### Módulos atuais

| Módulo | Camada | Papel |
| --- | --- | --- |
| `apps/service-management/script.js` | Vinculado ao DOM | Módulo de entrada: conexão de eventos, renderização, fluxos de importação/exportação. Detém toda interação com `document`/`window`. |
| `packages/designer-core/src/state/designerState.js` | Livre de DOM | Núcleo de estado e persistência: o objeto de estado, a cadeia de normalização `normalizeStatePayload`, snapshot/apply, histórico (undo/redo), `loadState`, `buildModelSnapshot`. |
| `packages/designer-core/src/store/IDesignerStore.js` | Livre de DOM, sem dependências | A porta de armazenamento: contrato + classe base. Importável sob qualquer runtime JavaScript. |
| `apps/service-management/src/store/CanaDesignerStore.js` | Livre de DOM | O único adaptador `IDesignerStore` (JUM-483), sobre o cliente Cana — injetado, nunca importado. |
| `apps/service-management/src/store/designerStoreFactory.js` | Livre de DOM | A costura de construção do store: `createDesignerStore()` sempre retorna `CanaDesignerStore`; o cliente Cana é a única variável. |
| `apps/service-management/src/store/canaMigration.js` | Livre de DOM | A migração unidirecional localStorage → Cana do JUM-484 (executada no boot antes de qualquer carga de estado) e os estados de ambiente de armazenamento declarados. |
| `apps/service-management/src/state/designerSync.js` | Livre de DOM | O motor de sincronização multi-abas do JUM-485: assina os eventos de escrita ordenados do Cana, os conecta entre abas via `BroadcastChannel` e reconcilia as mudanças remotas com o histórico local de undo/redo, a edição local pendente e a seleção. |

A direção das dependências é unidirecional: `script.js` →
`src/state/designerState.js` → (porta) `src/store/IDesignerStore.js` ←
`src/store/CanaDesignerStore.js` (construído por
`src/store/designerStoreFactory.js`). O núcleo de estado não importa nada
vinculado ao DOM nem nada concreto de armazenamento — ele conhece apenas a
porta.

> **Em andamento — [JUM-469](https://linear.app/jumentix/issue/JUM-469/refactor-modularize-designer-canvas-validation-exporters-importers).**
> Os módulos de exportadores, importadores, validação, canvas e guias estão
> sendo extraídos em paralelo e não fazem parte da tabela de módulos deste
> documento. Eles chegam via JUM-469 e estendem a mesma convenção: lógica
> livre de DOM em módulos sob `src/`, conexão vinculada ao DOM no módulo de
> entrada. Quando forem mergeados, esta tabela cresce; a regra de camadas não
> muda.

### O padrão de injeção

`script.js` constrói o núcleo uma única vez, no nível superior do módulo:

```js
const store = createDesignerStore();
const designerState = createDesignerState({
  store,
  seed,
  render,
  runtimeEnvDefaults: RUNTIME_ENV_EDITABLE_DEFAULTS
});
```

`createDesignerState({ store, seed, render, runtimeEnvDefaults })` recebe seus
três colaboradores impuros por injeção:

- **`store`** — um adaptador `IDesignerStore`. Toda persistência cruza esta
  fronteira; o núcleo nunca toca o `localStorage` diretamente.
- **`seed`** — um callback que popula `state` com o template padrão. O núcleo
  o chama na primeira execução e na recuperação, mas não sabe o que o template
  é.
- **`render`** — um callback invocado após undo/redo restaurar um snapshot,
  para que o núcleo possa disparar uma re-renderização sem importar o
  renderizador.
- **`runtimeEnvDefaults`** — valores padrão para a seção
  `runtimeEnvironment.values`, pertencentes aos metadados de ambiente da
  camada de UI.

Os objetos `state` e `history` retornados são **compartilhados por
referência**: a camada de UI muta `state` diretamente (como sempre fez) e
cada método do núcleo observa os mesmos objetos. Operações de mutação passam
por `withPersist(action, options)`, que registra o histórico antes da ação (a
menos que `options.recordHistory === false`) e salva depois dela. O histórico
é limitado a 100 entradas (`HISTORY_LIMIT`); registrar uma nova entrada limpa
o futuro de redo; `undo()`/`redo()` restauram um snapshot, salvam e chamam
`render()` — e são no-ops com passado/futuro vazio.

A inicialização executa primeiro a migração unidirecional do JUM-484 (veja a
seção de migração abaixo) e depois um único `await loadState()` em
`script.js`.

### O núcleo de estado (`src/state/designerState.js`)

- **Objeto de estado.** Um único objeto contendo as quatorze seções persistidas do
  documento `service-management.v1` (esquema fixado pelo
  [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
  — link, não cópia).
- **`normalizeStatePayload(parsed)`** — normaliza um payload decodificado no
  recorte do modelo restaurado no load. `domains`, `relationships`, as três
  seleções, `idCounter`, `codeWorkspace` e `view` retornam; as demais seções fixadas
  intencionalmente não são restauradas no load. A normalização descarta
  relacionamentos que apontam para entidades desconhecidas e limita a view
  (zoom para 0.5–2, estilo de aresta e severidade para seus enums).
- **`snapshotState()`/`applySnapshot()`** — copiam profundamente as seções
  persistidas para fora de `state` e as restauram de volta, recomputando
  `idCounter` a partir do maior sufixo numérico de id.
- **`saveState()`** — monta o payload de quatorze seções e chama
  `store.save(payload)` sem await (fire-and-forget, preservando o comportamento
  anterior à extração; veja a seção do adaptador para entender por que isso é
  seguro hoje e por que os chamadores não devem depender disso).
- **`loadState()`** — mapeia os resultados de load da porta para o estado do
  designer; veja a tabela de resultados abaixo.
- **`buildModelSnapshot()`** — monta o documento baseline de diff de esquema
  (`{ domains, relationships }`, formato fixado pelo Requisito 126 Contrato 2)
  que `script.js` grava através de `store.saveBaseline()`.

### O esquema de armazenamento `service-management.v1`

Todo o estado da suíte (as cinco guias) persiste como UM payload JSON sob a
chave única fixada `service-management.v1`; o baseline de diff de esquema vive
sob `service-management.schema-baseline.v1`. Desde a migração entregue do
JUM-484, ambos os documentos vivem no Cana — um único object store IndexedDB
(`designerDocuments`, banco `service-management`, esquema versão 1) — como
cópias de bytes dos mesmos documentos JSON que o adaptador localStorage
gravava. A era do localStorage é histórica; o formato de transmissão fixado agora
inclui `codeWorkspace`. O esquema — as quatorze
seções de nível superior, seus enums e o formato do baseline — é fixado pelo
[Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
e **não é duplicado aqui** para que os dois não divirjam. Qualquer mudança
estrutural deve incrementar a chave versionada e atualizar esse requisito no
mesmo PR. A porta em si é agnóstica de esquema: o formato de transmissão
fixado pertence ao adaptador e à migração (entregue) do JUM-484.

## O contrato da porta `IDesignerStore`

Fonte: [`packages/designer-core/src/store/IDesignerStore.js`](../../packages/designer-core/src/store/IDesignerStore.js).

### Por que a porta é moldada pelo Cana, não pelo localStorage

`LocalStorageDesignerStore` era TRANSICIONAL e agora está aposentado e
deletado: a migração unidirecional do `service-management.v1` do JUM-484 foi
entregue, deixando o `CanaDesignerStore` como única implementação da porta. O
Cana **não tem fallback para localStorage — nenhum fallback** (decisão de
2026-07-29). A porta é, portanto, moldada pela semântica que o Cana (um banco
de dados offline atrás de uma fronteira postmaster/worker) produz; o adaptador
localStorage apenas se esticava para se encaixar nela.

### A regra de não-fallback e sua consequência

Sob a regra de não-fallback, uma falha do adaptador emerge como estado do
designer — nunca como uma troca silenciosa para outro backend. Concretamente,
`loadState()` mapeia os resultados de load da porta para o comportamento de
recuperação:

| Resultado de `load()` | Significado | Comportamento de `loadState()` |
| --- | --- | --- |
| `'ok'` | Um documento armazenado foi encontrado e decodificado. | Normaliza e aplica o recorte do modelo. Se a própria normalização lançar exceção (payload corrompido mas decodificável), recupera exatamente como `'lost'`. |
| `'empty'` | Nada está armazenado. Primeira execução — NÃO é erro, NÃO é perda de dados. | Semeia o template padrão, persiste-o, limpa o histórico. |
| `'lost'` | O armazenamento estava disponível e continha dados que não são mais legíveis (despejo, corrupção). Distinto de `'empty'`. | Semeia, persiste o estado recuperado (sobrescrevendo o payload ilegível), redefine a view, limpa o histórico. |
| `'unavailable'` | O próprio backend de armazenamento não pode ser usado (modo privado, IndexedDB ausente). Terminal sob a regra de não-fallback. | Semeia **apenas em memória** — não há nada atrás do store para gravar, e nenhum fallback. |

O JUM-484 tornou esses estados visíveis em vez de silenciosos: no boot, o app
detecta e comunica quatro estados de ambiente de armazenamento declarados —
`unsupported-environment`, `non-persisting-session`, `data-lost` e
`degraded-durability` — através da região de status não bloqueante do JUM-543,
nunca `alert()` (veja a seção de migração abaixo para o significado de cada
estado). A semeadura apenas em memória no `'unavailable'` permanece, mas agora
é sempre comunicada ao usuário.

### Operações

Todas as sete operações são assíncronas e retornam Promises. O Cana roteia
através de um postmaster e workers, portanto toda operação cruza uma
fronteira. Adaptadores sobre backends síncronos executam seu trabalho
sincronamente e retornam Promises já resolvidas — **os chamadores NÃO DEVEM
confiar nisso** e DEVEM tratar todo resultado como assíncrono.

- **`probe()` → `DesignerStoreStatus`.** Pergunta sobre a saúde do
  armazenamento na inicialização, antes que qualquer estado exista:
  `'available'`, `'unavailable'` ou `'lost'`, com um `reason` legível opcional
  para estados não disponíveis. Responde sem exigir um `load()` anterior, de
  modo que modo privado e navegadores sem IndexedDB utilizável tornam-se
  estados terminais detectáveis sob a regra de não-fallback.
- **`load()` → `DesignerStoreLoadResult`.** Lê o documento de estado do
  designer persistido: `{ status: 'ok', payload }` quando um documento foi
  encontrado e decodificado; `{ status: 'empty' | 'unavailable' | 'lost',
  payload: null }` caso contrário, com um `reason` opcional para
  `'unavailable'`/`'lost'`.
- **`save(payload)` → `DesignerStoreSaveResult`.** Garante durabilidade ou diz
  que não pode:
  - `'persisted'` — a escrita é durável: qualquer `load()` subsequente contra
    o mesmo backend retorna este payload (até o próximo `save()`).
  - `'unknown'` — o resultado é indeterminado (por exemplo, um worker morreu
    após a escrita ser despachada). Um resultado desconhecido **NÃO DEVE ser
    reportado ao usuário como sucesso**.
  Adaptadores PODEM lançar exceções sincronamente para erros de programação
  (um payload não serializável); falhas de backend são reportadas através do
  resultado, nunca como `'persisted'`.
- **`clear()` → `DesignerStoreSaveResult`.** Remove o documento de estado.
  Resolver `'persisted'` significa que o documento se foi para sempre: um
  `load()` subsequente reporta `'empty'`.
- **`loadBaseline()` / `saveBaseline(snapshot)` / `clearBaseline()`.** O
  documento baseline de diff de esquema cruza a mesma fronteira de
  armazenamento, portanto a porta o carrega: estes seguem a mesma semântica de
  resultado de `load()`, `save()` e `clear()` respectivamente.

### A classe base falha ruidosamente

`IDesignerStore` é o contrato, não uma implementação: cada método base lança
`IDesignerStore.<method>() must be implemented by the adapter.` Adaptadores
DEVEM estender a classe e sobrescrever todos os métodos, de modo que um
adaptador parcial falhe ruidosamente em vez de silenciosamente descartar
estado do designer. A suíte de unidade assegura que todos os sete métodos base
rejeitam.

## A implementação de referência aposentada — e no que seu formato de transmissão se tornou

O `LocalStorageDesignerStore` era a implementação de referência da porta — um
adaptador transicional sobre localStorage que se esticava para se encaixar em
um contrato moldado pelo Cana. A migração entregue do JUM-484 o aposentou e o
**deletou** (`apps/service-management/src/store/LocalStorageDesignerStore.js`
não existe mais); seu comportamento é histórico. Dois fatos que ele fixava
continuam verdadeiros para o formato de transmissão e foram carregados
inalterados:

- **Chaves fixadas.** O documento de estado vive sob `service-management.v1` e
  o baseline de diff de esquema sob `service-management.schema-baseline.v1`,
  fixadas pelo Requisito 126 Contrato 2. A migração do JUM-484 lê a fonte sob
  essas mesmas chaves e grava os mesmos documentos no Cana — uma cópia de
  bytes, não uma transformação.
- **Um documento JSON por chave.** O formato de transmissão é um
  `JSON.stringify` do documento fixado por chave; apenas ONDE os documentos
  vivem mudou (o object store `designerDocuments` do Cana, IndexedDB), nunca o
  que eles contêm.

Todo o resto sobre aquele adaptador — trabalho síncrono atrás de Promises
resolvidas, JSON corrompido → `'lost'`, nunca reportar `'unknown'`,
`'unavailable'` apenas para backend ausente/que lança exceção — descrevia a
superfície degenerada do localStorage, não a porta, e não descreve mais nenhum
código em produção. Quem implementa deve ler o contrato da própria porta; o
único adaptador é o `CanaDesignerStore`.

## Implementando um novo adaptador: `CanaDesignerStore` (JUM-483)

Um novo adaptador DEVE:

1. Estender `IDesignerStore` e sobrescrever **todos os sete** métodos — as
   implementações base lançam exceção.
2. Honrar o contrato assíncrono: retornar Promises de todos os métodos; nunca
   exigir que os chamadores dependam de conclusão síncrona.
3. Honrar a semântica de resultados: `'persisted'` apenas quando um `load()`
   subsequente é garantido de retornar o payload; `'unknown'` (nunca sucesso)
   quando o resultado é indeterminado; `'empty'` apenas quando nada está
   armazenado; `'lost'` quando dados armazenados se foram ou estão ilegíveis —
   sempre distinguível de `'empty'`; `'unavailable'` quando o próprio backend
   não pode ser usado.
4. Carregar o documento baseline através da mesma fronteira com a mesma
   semântica (`loadBaseline`/`saveBaseline`/`clearBaseline`).
5. Reservar exceções síncronas para erros de programação; reportar falhas de
   backend através do objeto de resultado.

Os estados que um adaptador Cana produzirá e que o localStorage nunca produz:

- **`'unknown'`** — um worker morreu após a escrita ser despachada; o
  resultado é indeterminado.
- **`'lost'` por despejo** — a política de cota, persistência e despejo do
  Cana (Cana [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy))
  pode remover dados armazenados sob pressão de cota; sem nada atrás do Cana
  isso é perda de dados e deve emergir como `'lost'`, nunca como `'empty'`.
- **`'unavailable'` no `probe()`** — modo privado ou um navegador sem
  IndexedDB utilizável, detectável na inicialização antes que qualquer estado
  exista.

Sob a regra de não-fallback, estes emergem através de `loadState()` como
estado do designer (veja a tabela de resultados) — o designer nunca troca
silenciosamente para outro backend.

## O adaptador implementado: `CanaDesignerStore` (JUM-483)

Fontes:
[`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js)
(adaptador) e
[`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
(fábrica); suíte de unidade
[`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts).

O `CanaDesignerStore` implementa todos os sete métodos da porta sobre o
cliente Cana, e a troca **não exigiu nenhuma mudança na lógica do designer** —
a abstração da porta se sustentou. As decisões que um leitor precisa:

- **Formato de transmissão inalterado.** Ambos os documentos vivem em um
  único object store (`designerDocuments`, banco `service-management`, esquema
  versão 1) sob as chaves fixadas do Contrato 2, cada valor o exato
  `JSON.stringify` do mesmo documento que o adaptador transicional gravava. A
  migração do JUM-484 foi uma cópia de bytes, não uma transformação.
- **Mapeamento de estados.** IndexedDB ausente/inutilizável (Cana
  `'Unavailable'`) → `'unavailable'` no `probe()`/`load()`; despejo
  (`storageState().evicted` do Cana JUM-560, ou uma rejeição `'Evicted'`) sem
  registro encontrado → `'lost'`, nunca `'empty'` — enquanto um registro que
  É encontrado carrega normalmente; JSON ilegível → `'lost'`, como no
  adaptador transicional. Cota, despejo e resultado desconhecido emergem
  **distintamente**: dentro de um estado da porta, o `reason` é marcado
  (`quota:`, `evicted:`, `unknown-outcome:`, `unavailable:`).
- **Pressão de cota → qual estado da porta.** Uma escrita REJEITADA por cota
  não aconteceu; a porta não tem estado de falha determinística para escrita,
  então `save()` resolve `'unknown'` com `reason` `quota:` — nunca
  `'persisted'`. Pressão de cota que ainda não falhou uma escrita
  (`nearQuota`, armazenamento não persistente) emerge no `probe()` como
  `'available'` com um `reason` diagnóstico, alimentando os estados de
  ambiente do JUM-484.
- **Resultados desconhecidos carregam seus identificadores de reconciliação.**
  Escritas passam por `client.transaction()` (não pela tabela auto-commit)
  para que um resultado `'unknown'` embuta `correlationId`/`attemptedAt` no
  reason — os dois valores que `client.resolveWrite()` precisa (Cana
  JUM-411/559).
- **Aberturas falhas não são cacheadas.** `UpgradeBlocked` é transitório; a
  próxima operação tenta de novo em vez de transformar um mau momento em uma
  indisponibilidade permanente sem nada atrás.
- **Injeção de cliente, no estilo da fábrica.** O adaptador nunca importa
  `@jumentix/cana`: o cliente é injetado (`client`/`clientProvider`), espelhando
  o `indexedDbClient` de `buildDatabaseClientCompilers`. O JUM-484 removeu a
  seleção de driver da costura — não há mais precedência: sem argumento
  `driver`, sem global ambiente `JUMENTIX_DESIGNER_STORE_DRIVER`, sem parâmetro
  de URL `?designer-store=`, sem padrão `localstorage`. `createDesignerStore()`
  sempre retorna `CanaDesignerStore`; a única variável é o próprio cliente Cana
  (`canaClient`, uma fábrica `indexedDbClient` ou `canaModuleSpecifier` para o
  provedor padrão tardio). Sem cliente conectado, o provedor padrão importa
  `@jumentix/cana` tardiamente (`import()`) e constrói via
  `createCanaDatabaseClient`; no navegador, o especificador bare resolve
  através do import map em `index.html` para o bundle vendored
  (`vendor/cana/index.js`, ignorado pelo git, regenerado por
  `ci-cd/sync-service-management-cana-bundle.js`). Um host que não consegue
  resolvê-lo recebe `'unavailable'`, nunca um fallback silencioso.

## A migração unidirecional: `canaMigration.js` (JUM-484)

Fonte:
[`apps/service-management/src/store/canaMigration.js`](../../apps/service-management/src/store/canaMigration.js).

A migração do JUM-484 foi entregue e roda no boot, antes de qualquer carga de
estado. Sem fallback para onde recuar, a segurança vem da construção:

1. **Exportar antes de migrar.** Um backup baixável do payload verbatim do
   localStorage (`service-management-v1-backup-<timestamp>.json`) é produzido
   ANTES de qualquer escrita no Cana e anunciado ao usuário — o recurso que
   substitui o fallback.
2. **Verificar antes da virada.** O payload de estado e o baseline de diff de
   esquema são gravados através da porta, relidos e comparados em conteúdo
   contra a fonte. Apenas uma migração verificada grava seu marcador
   (`service-management.v1.cana-migration`, JSON
   `{version, status: 'verified', migratedAt, sourceRetainedUntil}`); qualquer
   falha deixa a fonte intocada e a migração reexecutável.
3. **Retenção postergada da fonte.** O payload-fonte do localStorage permanece
   no lugar, SEM USO, por 30 dias após uma migração verificada — um caminho de
   recuperação manual, nunca um fallback: nenhum código o lê como store. Após o
   período de retenção o boot o remove; o marcador verificado permanece.
4. **Idempotente.** As escritas são `put`s do mesmo payload sob as mesmas
   chaves fixadas, portanto uma migração interrompida reexecuta para o mesmo
   resultado, e um marcador verificado curto-circuita a reentrada.
5. **Versionamento de esquema no Cana.** O banco Cana é versionado
   (`schema.version = 1`) e uma migração verificada grava um registro de
   proveniência sob `service-management.migration.v1` (versão, fonte,
   timestamps, retenção) para que uma migração futura tenha uma versão sobre a
   qual raciocinar.

O formato de transmissão NÃO mudou (Requisito 126 Contrato 2): mesmas chaves,
mesmos documentos JSON — apenas onde vivem. O baseline atravessa quando
presente; um baseline ausente permanece ausente, nunca fabricado.

O mesmo módulo declara os estados de ambiente de armazenamento que a decisão
de não-fallback torna obrigatórios — `describeDesignerStorageEnvironment()`
mapeia a presença de IndexedDB e o `probe()` para quatro estados, renderizados
no boot através da região de status não bloqueante do JUM-543 (nunca
`alert()`):

- **`unsupported-environment`** (severidade error) — um navegador sem
  IndexedDB utilizável: o designer pode ser explorado, mas nada pode ser salvo.
- **`non-persisting-session`** (severidade error) — armazenamento
  privado/incógnito/bloqueado (`probe()` → `'unavailable'`): o designer não
  consegue persistir; qualquer coisa construída nesta sessão será perdida.
- **`data-lost`** (severidade error) — `probe()` → `'lost'` (despejo,
  corrupção): dados salvos anteriormente não são mais legíveis e não há store
  de fallback; um template novo é carregado e o recurso é um backup/exportação
  anterior.
- **`degraded-durability`** (severidade info) — `probe()` → `'available'` com
  um `reason` diagnóstico (quase na cota, armazenamento não persistente):
  funcionando, mas com durabilidade degradada.

## Sincronização multi-abas por eventos de escrita: `designerSync.js` (JUM-485)

Fonte:
[`apps/service-management/src/state/designerSync.js`](../../apps/service-management/src/state/designerSync.js).

O JUM-485 torna o designer consistente entre abas. O motor de sincronização
assina os eventos de escrita ordenados do cliente Cana local
(`CanaClient.subscribe`, Cana JUM-413) e republica o documento de estado
confirmado em um `BroadcastChannel` compartilhado, marcado com o `originId`
da própria aba — o canal é a fronteira entre abas, porque o Cana publica
eventos confirmados apenas para a instância de cliente assinante e cada aba
detém seu próprio cliente. O `originId` também é a proteção contra eco: uma
mensagem atribuída a esta aba nunca é aplicada como remota. A recuperação de
mudanças remotas é sempre por releitura do documento; o cursor de eventos
persistido governa apenas o fluxo de eventos local (um cursor que a janela
retida não cobre mais lança o `'NotFound'` do Cana, respondido com uma
ressincronização completa), de modo que uma aba fechada ou em segundo plano
retoma sem perda nem duplicação. Uma tempestade de eventos remotos
(importação em massa) coalesce em uma única aplicação final.

A issue exigiu respostas explícitas a três perguntas; elas estão registradas
no cabeçalho do módulo e garantidas por teste:

1. **O undo é somente local; mudanças remotas não são desfazíveis.** Aplicações
   remotas nunca entram na pilha de undo, e uma mudança remota trunca o ramo
   de redo em vez de deixar uma pilha que reexecuta para um estado que não
   existe mais. Desfazer uma ação LOCAL após uma mudança remota restaura o
   snapshot local como uma nova escrita local deliberada
   (last-writer-wins de documento inteiro), nunca um undo DA mudança remota.
2. **Uma edição local pendente mantém sua superfície não salva enquanto o
   documento confirmado vence.** A mudança remota é aplicada ao `state`; a
   re-renderização preserva o input em edição, o foco, o cursor de texto e o
   scroll/zoom do canvas, e o `view`/`activeTab`/seleção do documento remoto
   nunca são importados. A região de status (JUM-543) anuncia a mudança; a
   próxima gravação explícita do usuário impõe sua versão.
3. **A seleção é por aba e reconciliada, nunca importada.** Uma remoção remota
   do relacionamento/entidade selecionado limpa a seleção; uma remoção remota
   do domínio selecionado move a seleção para o primeiro domínio restante.
   Toda reconciliação é anunciada — uma seleção pendente é impossível.

A regra de não-fallback também vale aqui: um canal ou store indisponível é um
estado DECLARADO através da região de status (o designer nunca volta
silenciosamente a ser uma aplicação local de aba única que continua
gravando), e uma gravação cujo resultado o Cana reporta como `'unknown'`
(worker quebrado após o despacho, Cana JUM-411) é exposta e reconciliada
relendo o documento armazenado — nunca assumida como bem-sucedida
silenciosamente.

## Referências

- Contrato da porta: [`packages/designer-core/src/store/IDesignerStore.js`](../../packages/designer-core/src/store/IDesignerStore.js)
- Migração unidirecional + estados de ambiente: [`apps/service-management/src/store/canaMigration.js`](../../apps/service-management/src/store/canaMigration.js)
- Adaptador Cana + fábrica: [`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js), [`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
- Núcleo de estado: [`packages/designer-core/src/state/designerState.js`](../../packages/designer-core/src/state/designerState.js)
- Motor de sincronização multi-abas: [`apps/service-management/src/state/designerSync.js`](../../apps/service-management/src/state/designerSync.js)
- Módulo de entrada: [`apps/service-management/script.js`](../../apps/service-management/script.js)
- Suítes de unidade: [`designerStore.test.ts`](../../apps/backend-template/test/unit/service-management/designerStore.test.ts), [`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts), [`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts), [`designerSync.test.ts`](../../apps/backend-template/test/unit/service-management/designerSync.test.ts)
- Esquema de armazenamento: [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
- Visão geral do componente: [Aplicativo de gerenciamento de serviços](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md)
- Linear: [JUM-468](https://linear.app/jumentix/issue/JUM-468/refactor-extract-statepersistence-core-as-es-module-behind) (a porta), [JUM-469](https://linear.app/jumentix/issue/JUM-469/refactor-modularize-designer-canvas-validation-exporters-importers) (o grafo de módulos), [JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client) (CanaDesignerStore), [JUM-484](https://linear.app/jumentix/issue/JUM-484) (a migração unidirecional entregue que aposentou o adaptador transicional), [JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message) (sincronização multi-abas por eventos de escrita), [JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry) (publicação do pacote), Cana [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy) (política de cota/despejo)
