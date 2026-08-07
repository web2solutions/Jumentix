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

A arquitetura é uma única regra: **a lógica pura vive em módulos livres de DOM
sob `src/`; o acesso ao DOM vive no módulo de entrada.** O conjunto livre de
DOM é o que pode ser testado em unidade sob Bun/Node sem shim de DOM — e o que
o JUM-493 pode publicar — portanto a fronteira é a arquitetura. A fronteira é
garantida por um teste: `designerState.test.ts` lê os três módulos de `src/`,
remove os comentários e falha se `document.` ou `window.` aparecer.

### Módulos atuais

| Módulo | Camada | Papel |
| --- | --- | --- |
| `apps/service-management/script.js` | Vinculado ao DOM | Módulo de entrada: conexão de eventos, renderização, fluxos de importação/exportação. Detém toda interação com `document`/`window`. |
| `apps/service-management/src/state/designerState.js` | Livre de DOM | Núcleo de estado e persistência: o objeto de estado, a cadeia de normalização `normalizeStatePayload`, snapshot/apply, histórico (undo/redo), `loadState`, `buildModelSnapshot`. |
| `apps/service-management/src/store/IDesignerStore.js` | Livre de DOM, sem dependências | A porta de armazenamento: contrato + classe base. Importável sob qualquer runtime JavaScript. |
| `apps/service-management/src/store/LocalStorageDesignerStore.js` | Livre de DOM | Adaptador `IDesignerStore` TRANSICIONAL sobre `localStorage`. Aposentado pelo JUM-484. |

A direção das dependências é unidirecional: `script.js` →
`src/state/designerState.js` → (porta) `src/store/IDesignerStore.js` ←
`src/store/LocalStorageDesignerStore.js`. O núcleo de estado não importa nada
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
const store = new LocalStorageDesignerStore();
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

A inicialização é um único `await loadState()` em `script.js`.

### O núcleo de estado (`src/state/designerState.js`)

- **Objeto de estado.** Um único objeto contendo as doze seções persistidas do
  documento `service-management.v1` (esquema fixado pelo
  [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
  — link, não cópia).
- **`normalizeStatePayload(parsed)`** — normaliza um payload decodificado no
  recorte do modelo restaurado no load. Apenas `domains`, `relationships`, as
  três seleções, `idCounter` e `view` retornam; as demais seções fixadas
  intencionalmente não são restauradas no load. A normalização descarta
  relacionamentos que apontam para entidades desconhecidas e limita a view
  (zoom para 0.5–2, estilo de aresta e severidade para seus enums).
- **`snapshotState()`/`applySnapshot()`** — copiam profundamente as seções
  persistidas para fora de `state` e as restauram de volta, recomputando
  `idCounter` a partir do maior sufixo numérico de id.
- **`saveState()`** — monta o payload de doze seções e chama
  `store.save(payload)` sem await (fire-and-forget, preservando o comportamento
  anterior à extração; veja a seção do adaptador para entender por que isso é
  seguro hoje e por que os chamadores não devem depender disso).
- **`loadState()`** — mapeia os resultados de load da porta para o estado do
  designer; veja a tabela de resultados abaixo.
- **`buildModelSnapshot()`** — monta o documento baseline de diff de esquema
  (`{ domains, relationships }`, formato fixado pelo Requisito 126 Contrato 2)
  que `script.js` grava através de `store.saveBaseline()`.

### O esquema de armazenamento `service-management.v1`

Todo o estado da suíte (as quatro guias) persiste como UM payload JSON sob a
chave única de localStorage `service-management.v1`; o baseline de diff de
esquema vive sob `service-management.schema-baseline.v1`. O esquema — as doze
seções de nível superior, seus enums e o formato do baseline — é fixado pelo
[Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
e **não é duplicado aqui** para que os dois não divirjam. Qualquer mudança
estrutural deve incrementar a chave versionada e atualizar esse requisito no
mesmo PR. A porta em si é agnóstica de esquema: o formato de transmissão
fixado pertence ao adaptador transicional e à migração do JUM-484.

## O contrato da porta `IDesignerStore`

Fonte: [`apps/service-management/src/store/IDesignerStore.js`](../../apps/service-management/src/store/IDesignerStore.js).

### Por que a porta é moldada pelo Cana, não pelo localStorage

`LocalStorageDesignerStore` é TRANSICIONAL: ele carrega o designer apenas até
a migração unidirecional do `service-management.v1` do JUM-484 aposentá-lo. O
Cana **não tem fallback para localStorage — nenhum fallback** (decisão de
2026-07-29). A porta é, portanto, moldada pela semântica que o Cana (um banco
de dados offline atrás de uma fronteira postmaster/worker) produz, e o
adaptador localStorage se estica para se encaixar.

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

## A implementação de referência — e o que ela não consegue expressar

Fonte:
[`apps/service-management/src/store/LocalStorageDesignerStore.js`](../../apps/service-management/src/store/LocalStorageDesignerStore.js).

`LocalStorageDesignerStore` é a implementação de referência, mas a porta é
moldada pelo Cana e este adaptador **se estica para se encaixar**. Seu
comportamento não deve ser confundido com o contrato:

- **Trabalho síncrono atrás de Promises resolvidas.** localStorage é síncrono,
  portanto cada método executa seu trabalho antes de retornar uma Promise já
  resolvida. `save()` executa `setItem` sincronamente, preservando a
  durabilidade fire-and-forget anterior à extração para chamadores que não
  usam await (todo o designer hoje). Nenhum chamador pode depender desse
  timing — a porta é assíncrona.
- **`setItem` que lança exceção propaga sincronamente.** Um erro de cota ou de
  armazenamento bloqueado de `setItem`/`removeItem` lança para fora de
  `save()`/`clear()` até o chamador, exatamente como o acesso direto ao
  `localStorage` anterior à extração se comportava (garantido por teste).
- **JSON corrompido → `'lost'`.** Um payload armazenado que não é JSON válido
  é a única corrupção que o localStorage consegue expressar, e ele reporta
  `'lost'` — nunca `'empty'`. Despejo verdadeiro não tem análogo em
  localStorage e nunca é reportado por este adaptador.
- **`'unknown'` nunca é reportado.** Um `setItem` que retorna é durável pelo
  contrato de armazenamento HTML, e um que lança propaga — portanto este
  adaptador nunca resolve `'unknown'`.
- **`'unavailable'` apenas para backend ausente/que lança exceção.** O global
  `localStorage` ambiente é resolvido tardiamente e defensivamente (o acesso à
  propriedade em si pode lançar quando o armazenamento está bloqueado). Sem
  backend, um global que lança, ou um `getItem` que lança, todos reportam
  `'unavailable'`; um `getItem` retornando `null` (ou `undefined`) reporta
  `'empty'`. `probe()` grava e remove uma chave `${stateKey}.probe`: sucesso é
  `'available'`, uma exceção é `'unavailable'` com a mensagem de erro como
  `reason`.
- **Chaves fixadas.** As chaves padrão são exportadas como
  `LOCAL_STORAGE_STATE_KEY` (`service-management.v1`) e
  `LOCAL_STORAGE_BASELINE_KEY` (`service-management.schema-baseline.v1`),
  fixadas pelo Requisito 126 Contrato 2. O construtor aceita overrides de
  `storage`, `stateKey` e `baselineKey` para testes; o formato de transmissão
  (um `JSON.stringify` sob a chave fixada) não deve mudar aqui — o esquema
  pertence à migração do JUM-484.

Como este adaptador raramente reportará `'unavailable'` ou `'lost'` e nunca
reporta `'unknown'`, um implementador lendo apenas seu comportamento perderia
a maior parte do contrato. O contrato é a porta; esta classe é um backend
degenerado.

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
(costura de seleção); suíte de unidade
[`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts).

O `CanaDesignerStore` implementa todos os sete métodos da porta sobre o
cliente Cana, e a troca **não exigiu nenhuma mudança na lógica do designer** —
a abstração da porta se sustentou. As decisões que um leitor precisa:

- **Formato de transmissão inalterado.** Ambos os documentos vivem em um
  único object store (`designerDocuments`, banco `service-management`, esquema
  versão 1) sob as chaves fixadas do Contrato 2, cada valor o exato
  `JSON.stringify` do mesmo documento que o adaptador transicional grava. A
  migração do JUM-484 é uma cópia de bytes, não uma transformação.
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
  o `indexedDbClient` de `buildDatabaseClientCompilers`. A costura
  (`createDesignerStore`) seleciona por nome (`cana`, aliases `indexeddb`/
  `indexed-db`, como o normalizador da fábrica), com precedência argumento
  explícito → global ambiente `JUMENTIX_DESIGNER_STORE_DRIVER` → parâmetro de
  URL `?designer-store=cana` → **padrão `localstorage`**. Sem cliente
  conectado, o provedor padrão importa `@jumentix/cana` tardiamente
  (`import()`) e constrói via `createCanaDatabaseClient`; um host que não
  consegue resolvê-lo recebe `'unavailable'`, nunca um fallback silencioso. O
  padrão permanece localStorage até a migração do JUM-484 tornar o store Cana
  o único.

## Referências

- Contrato da porta: [`apps/service-management/src/store/IDesignerStore.js`](../../apps/service-management/src/store/IDesignerStore.js)
- Adaptador transicional: [`apps/service-management/src/store/LocalStorageDesignerStore.js`](../../apps/service-management/src/store/LocalStorageDesignerStore.js)
- Adaptador Cana + costura de seleção: [`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js), [`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
- Núcleo de estado: [`apps/service-management/src/state/designerState.js`](../../apps/service-management/src/state/designerState.js)
- Módulo de entrada: [`apps/service-management/script.js`](../../apps/service-management/script.js)
- Suítes de unidade: [`designerStore.test.ts`](../../apps/backend-template/test/unit/service-management/designerStore.test.ts), [`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts), [`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts)
- Esquema de armazenamento: [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
- Visão geral do componente: [Aplicativo de gerenciamento de serviços](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md)
- Linear: [JUM-468](https://linear.app/jumentix/issue/JUM-468/refactor-extract-statepersistence-core-as-es-module-behind) (a porta), [JUM-469](https://linear.app/jumentix/issue/JUM-469/refactor-modularize-designer-canvas-validation-exporters-importers) (o grafo de módulos), [JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client) (CanaDesignerStore), [JUM-484](https://linear.app/jumentix/issue/JUM-484) (migração que aposenta o adaptador transicional), [JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry) (publicação do pacote), Cana [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy) (política de cota/despejo)
