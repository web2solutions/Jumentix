# Cana — Guia de Uso

Referência completa da API e guia orientado a tarefas do `@jumentix/cana`.

A cobertura de tópicos aqui segue o que uma biblioteca IndexedDB de trabalho
precisa documentar — primeiros passos, schema e versionamento, CRUD, consultas,
transações, hooks, notificação de mudanças, erros, limites de armazenamento,
workers, testes e resolução de problemas. A documentação do Dexie foi usada como
checklist de *quais assuntos cobrir*; cada palavra, exemplo e API aqui é do
próprio Cana.

Para a fundamentação de projeto por trás desses comportamentos, veja
[CANA-INDEXEDDB-ADAPTER.pt-BR.md](./CANA-INDEXEDDB-ADAPTER.pt-BR.md). Este
documento é sobre usar. Inglês: [CANA-USAGE-GUIDE.md](./CANA-USAGE-GUIDE.md).

---

## Sumário

1. [Primeiros passos](#1-primeiros-passos)
2. [Schema e versionamento](#2-schema-e-versionamento)
3. [Chaves](#3-chaves)
4. [Leitura e escrita](#4-leitura-e-escrita)
5. [Operações em lote](#5-operações-em-lote)
6. [Consultas](#6-consultas)
7. [Transações](#7-transações)
8. [Eventos de mudança](#8-eventos-de-mudança)
9. [Hooks](#9-hooks)
10. [Erros](#10-erros)
11. [Armazenamento, cota e despejo](#11-armazenamento-cota-e-despejo)
12. [Recuperação de falhas](#12-recuperação-de-falhas)
13. [Exportação e importação](#13-exportação-e-importação)
14. [Uso com a factory de clientes Jumentix](#14-uso-com-a-factory-de-clientes-jumentix)
15. [Workers](#15-workers)
16. [Testando seu próprio código](#16-testando-seu-próprio-código)
17. [Resolução de problemas](#17-resolução-de-problemas)
18. [Referência da API](#18-referência-da-api)

---

## 1. Primeiros passos

```bash
bun add @jumentix/cana
```

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      {
        name: 'designs',
        keyPath: 'id',
        indexes: [
          { name: 'byOwner', keyPath: 'owner' },
          { name: 'byUpdatedAt', keyPath: 'updatedAt' }
        ]
      }
    ]
  }
});

await client.open();
```

**`open()` não é implícito.** Nenhuma operação abre o banco por você. Uma abertura
implícita esconderia uma atualização de schema — possivelmente longa e
bloqueante — atrás de uma chamada não relacionada como `get()`. Chamar uma tabela
antes de `open()` resolver falha com `InvalidRequest`.

`open()` é idempotente; chamar duas vezes não faz nada.

### Tipando seus registros

Passe o tipo do registro no ponto de chamada:

```ts
interface Design {
  id: number;
  name: string;
  owner: string;
  updatedAt: number;
}

const designs = client.table<Design>('designs');
const one = await designs.get(1);   // Design | undefined
```

Para tipar também a chave:

```ts
const designs = client.table<Design, number>('designs');
```

---

## 2. Schema e versionamento

Um schema é dado puro:

```ts
const schema = {
  version: 2,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'drafts', autoIncrement: true },
    { name: 'members', keyPath: ['tenantId', 'userId'] }
  ]
};
```

### Atualizando

Aumente `version` e mude `stores`. O IndexedDB aplica mudanças de schema
**somente** quando a versão aumenta — esta é a origem mais comum de "minha
mudança não fez nada".

```ts
// v1
{ version: 1, stores: [{ name: 'designs', keyPath: 'id' }] }

// v2 — adiciona um store e um índice
{
  version: 2,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'deployments', keyPath: 'id' }
  ]
}
```

### O que uma atualização faz e não faz

| Mudança | Aplicada automaticamente? |
|---|---|
| Store novo | Sim |
| Índice novo em qualquer store | Sim |
| Store ausente do schema | **Não — é mantido** |
| Definição de índice alterada | **Não — é mantida** |
| `keyPath` ou `autoIncrement` alterado | **Não** |

Stores nunca são removidos automaticamente. `deleteObjectStore` é irreversível, e
fazer isso porque um store sumiu de um literal de schema significa que um erro de
digitação apaga a tabela de um usuário. Remoção é migração explícita, escrita por
você.

Um índice já existente é mantido mesmo se a definição mudou. Recriá-lo
reconstruiria o índice inteiro dentro da transação de atualização, o que em um
store grande é um bloqueio longo. Renomeie o índice para forçar a reconstrução.

### Downgrades são recusados

Abrir a versão 2 contra um banco escrito na versão 3 falha com `UpgradeFailed` e
uma mensagem nomeando ambas as versões. Isso acontece rotineiramente quando um
usuário tem duas abas abertas durante um deploy.

### A validação acontece antes de qualquer toque

`validateSchema` roda primeiro e rejeita:

- `version` não inteira ou não positiva
- schema sem stores
- nomes duplicados de store ou índice
- `keyPath` vazio, ou segmento vazio em um composto
- **`multiEntry` combinado com `keyPath` composto** — o IndexedDB proíbe, e
  reporta de dentro da transação de atualização, onde aparece como migração
  quebrada em vez de schema inválido

```ts
import { validateSchema } from '@jumentix/cana';

const problems = validateSchema(schema);   // readonly string[]; vazio significa OK
```

---

## 3. Chaves

O IndexedDB tem duas formas de chave, e confundi-las é fonte comum de problemas.

| Forma | Declaração | Como a chave é fornecida |
|---|---|---|
| Inbound | `keyPath: 'id'` | Dentro do registro |
| Inbound, gerada | `keyPath: 'id', autoIncrement: true` | Dentro do registro, ou omitida |
| Outbound | sem `keyPath` | Como segundo argumento |
| Outbound, gerada | `autoIncrement: true` | Omitida |

```ts
// Inbound: a chave vive no registro
await client.table('designs').add({ id: 1, name: 'a' });

// Outbound: a chave vai ao lado
await client.table('cache').put({ body: '...' }, 'https://example.com/x');
```

Passar chave explícita a um store inbound falha com `InvalidRequest` e uma
mensagem nomeando o `keyPath` do store. O erro do próprio IndexedDB para isso é
um `DataError` seco que não diz o motivo.

`keyStrategyOf(store)` retorna `inbound | generated-inbound | outbound |
generated-outbound` se você precisar decidir com base nisso.

### Tipos de chave válidos

`number`, `string`, `Date`, `ArrayBuffer`, `ArrayBufferView` e arrays desses
(chaves compostas). `CanaKey` é um tipo próprio do Cana em vez de `IDBValidKey`,
para que nenhum tipo do IndexedDB atravesse a fronteira.

Chaves compostas ordenam da esquerda para a direita:

```ts
{ name: 'members', keyPath: ['tenantId', 'userId'] }
await table.get(['acme', 42]);
```

---

## 4. Leitura e escrita

```ts
const designs = client.table<Design>('designs');

await designs.get(1);                          // Design | undefined
await designs.add({ id: 1, name: 'first' });   // falha se a chave existir
await designs.put({ id: 1, name: 'replaced' }); // insere ou substitui
await designs.update(1, { name: 'renamed' });  // mescla em um registro existente
await designs.delete(1);
await designs.clear();
```

### `add` vs `put` vs `update`

| Chamada | Chave existe | Chave não existe |
|---|---|---|
| `add` | `ConstraintViolation` | insere |
| `put` | substitui o registro inteiro | insere |
| `update` | mescla os campos dados | **`NotFound`** |

`update` não insere. Um upsert com nome de update ressuscita registros que outra
aba excluiu, e a linha ressuscitada não tem os campos que o resto do schema
espera. Use `put` quando quiser upsert.

`update` é leitura-modificação-escrita **dentro de uma transação**, então duas
abas atualizando campos diferentes do mesmo registro não perdem as mudanças uma
da outra.

### O resultado

Toda escrita retorna:

```ts
{
  outcome: 'committed' | 'rolled-back' | 'unknown',
  key?: CanaKey,
  events: readonly CanaChangeEvent[]
}
```

`events` só é preenchido quando `outcome === 'committed'`.

### Excluir uma chave que não existe

Tem sucesso, e emite **nenhum** evento. O IndexedDB exclui uma chave ausente
silenciosamente; anunciar mesmo assim diria aos assinantes que um registro sumiu
sem nunca ter existido.

---

## 5. Operações em lote

```ts
await designs.bulkAdd([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
await designs.bulkPut([{ id: 1, name: 'changed' }, { id: 3, name: 'new' }]);
await designs.bulkDelete([1, 2]);
```

Escritas em lote são **atômicas**: uma linha falhando desfaz o lote inteiro. A
alternativa — confirmar as linhas 1..k e reportar erro — deixa você sem saber até
onde foi.

```ts
{
  outcome: 'committed',
  keys: readonly CanaKey[],       // na ordem de entrada
  failedAt?: readonly number[],   // índices dentro da entrada
  events: readonly CanaChangeEvent[]
}
```

As linhas são escritas sequencialmente para que `keys` e `failedAt` correspondam
à sua entrada.

`bulkPut` reporta cada linha como `created` ou `updated` conforme o que de fato
aconteceu, igual ao `put` simples. Em um store outbound, sem chave para sondar,
toda linha reporta `created`.

---

## 6. Consultas

```ts
// Tudo
await designs.query();

// Por índice, correspondência exata
await designs.query({ index: 'byOwner', equals: 'ana' });

// Intervalo
await designs.query({ index: 'byUpdatedAt', range: { lower: start, upper: end } });

// Intervalo semiaberto
await designs.query({ index: 'byUpdatedAt', range: { lower: start, upperOpen: true } });

// Ordem inversa, limitada
await designs.query({ index: 'byUpdatedAt', direction: 'prev', limit: 20 });

// Paginação
await designs.query({ index: 'byUpdatedAt', offset: 40, limit: 20 });

// Somente valores únicos
await designs.query({ index: 'byOwner', distinct: true });
```

### `CanaQuery`

| Campo | Significado |
|---|---|
| `index` | Lê por este índice em vez da chave primária |
| `equals` | Correspondência exata de chave |
| `range` | `{ lower, upper, lowerOpen, upperOpen }` |
| `direction` | `next` (padrão), `prev`, `nextunique`, `prevunique` |
| `offset` | Registros a pular, aplicado avançando o cursor |
| `limit` | Máximo a retornar; o cursor para ali |
| `distinct` | Atalho para uma direção `*unique` |

`equals` tem precedência sobre `range` quando ambos são dados.

### Contando

```ts
await designs.count();                                   // tudo
await designs.count({ index: 'byOwner', equals: 'ana' }); // correspondentes
```

`count` usa a contagem nativa do IndexedDB — uma requisição, nenhum registro
lido. Uma consulta com `offset` ou `limit` não pode ser contada nativamente,
então recorre ao cursor. Ainda assim concorda com `query` na mesma entrada.

### `explain` — verificando que um índice foi usado

```ts
const { records, plan } = await designs.explain({ index: 'byOwner', equals: 'ana' });

plan.usedIndex             // 'byOwner'
plan.fullScan              // false
plan.boundedByRange        // true
plan.appliedOffsetInCursor // false
```

`fullScan` é verdadeiro apenas quando nada estreita a leitura: sem índice e sem
limite. Esse é o caso que degrada com o volume de dados em vez de com a
complexidade da consulta, então vale afirmar isso nos seus próprios testes:

```ts
it('não faz varredura completa na tabela designs', async () => {
  const { plan } = await designs.explain({ index: 'byOwner', equals: currentUser });
  expect(plan.fullScan).toBe(false);
});
```

### O que o Cana não faz

Não existe `.filter(record => ...)` baseado em expressão. Filtrar em JavaScript
depois de ler todos os registros é justamente o modo de falha que `explain()`
existe para tornar visível, então não é oferecido como operação de primeira
classe. Leia um conjunto limitado e filtre você mesmo, deliberadamente:

```ts
const recent = await designs.query({ index: 'byUpdatedAt', range: { lower: since } });
const mine = recent.filter((design) => design.owner === me);
```

Também não há joins. Leia de cada store dentro de uma transação.

---

## 7. Transações

```ts
const { outcome, result, events, correlationId, attemptedAt } =
  await client.transaction('readwrite', ['designs', 'deployments'], async (scope) => {
    const design = await scope.table<Design>('designs').get(1);
    await scope.table('deployments').add({ id: 9, designId: design.id });
    return design;
  });
```

Tudo no corpo confirma junto ou nada confirma.

### A única regra

> **Nunca faça `await` de nada além de uma requisição IndexedDB dentro de uma
> transação.**

Uma transação IndexedDB confirma sozinha assim que o event loop cede sem
requisições pendentes contra ela. Então isto não pausa a transação — ele a
*encerra*:

```ts
// ERRADO
await client.transaction('readwrite', ['designs'], async (scope) => {
  const remote = await fetch('/api/design/1');   // ← a transação termina aqui
  await scope.table('designs').put(await remote.json());  // TransactionInactive
});
```

```ts
// CERTO — busque primeiro, depois abra a transação
const remote = await (await fetch('/api/design/1')).json();
await client.transaction('readwrite', ['designs'], async (scope) => {
  await scope.table('designs').put(remote);
});
```

Aguardar uma chamada de tabela do Cana é seguro: a promise dela resolve em um
microtask a partir do handler de sucesso do IndexedDB, antes de a tarefa ceder.

Não existe `commit()`. Expor um sugeriria que você controla um tempo de vida que
não controla.

### Abortando

```ts
await client.transaction('readwrite', ['designs'], async (scope) => {
  await scope.table('designs').add({ id: 1, name: 'a' });
  scope.abort('o usuário cancelou');
});
```

Rejeita com `TransactionAborted` carregando o seu motivo. Nada é escrito, e
**nenhum evento é emitido** — um assinante nunca pode ver uma mudança que foi
desfeita, porque não dá para mandá-lo "des-ver".

Lançar exceção no corpo tem o mesmo efeito.

### Escopo

Nomeie todo store que você vai tocar. Tocar um fora do escopo falha. Transações
somente leitura podem rodar concorrentemente; transações `readwrite` sobre stores
sobrepostos são serializadas pelo navegador.

---

## 8. Eventos de mudança

```ts
const stop = client.subscribe((event) => {
  console.log(event.type, event.store, event.key);
});

stop();  // cancela a assinatura
```

### `CanaChangeEvent`

| Campo | Significado |
|---|---|
| `type` | `created` \| `updated` \| `deleted` \| `cleared` |
| `store` | Nome do store |
| `key` | Chave afetada; ausente em `cleared` |
| `record` | O registro escrito; ausente em `deleted` e `cleared` |
| `cursor` | Número de sequência monotônico |
| `correlationId` | Compartilhado por todos os eventos de uma transação |
| `at` | Milissegundos desde a época |
| `originId` | Identifica o cliente que escreveu |

Eventos são publicados **somente para escritas confirmadas**, após a
durabilidade.

### Ignorando suas próprias escritas

```ts
const client = createClient({ ..., originId: 'tab-a' });
client.subscribe((event) => {
  if (event.originId === 'tab-a') return;   // nosso próprio eco
  applyRemoteChange(event);
});
```

### Ordem e isolamento

Ouvintes rodam na ordem de registro. Um ouvinte que lança exceção não impede os
outros e não perde o evento — um assinante quebrado não pode virar uma
inconsistência de banco inteiro reportada longe da causa.

### Retomando após uma lacuna

```ts
let lastSeen = loadCursorFromSomewhere();

const stop = client.subscribe(
  (event) => { apply(event); lastSeen = event.cursor; },
  { sinceCursor: lastSeen }
);
```

Os eventos desde aquele cursor são reproduzidos sincronamente antes de
`subscribe` retornar.

Se o cursor pedido caiu para fora da janela retida, `subscribe` **lança
`NotFound`** em vez de reproduzir o que sobrou. Uma reprodução parcial pareceria
completa e omitiria o meio silenciosamente. Recarregue do banco:

```ts
try {
  client.subscribe(apply, { sinceCursor: lastSeen });
} catch (error) {
  if (isCanaErrorCode(error, 'NotFound')) {
    await reloadEverything();
    client.subscribe(apply);
  }
}
```

A janela é de 1000 eventos por padrão; ajuste com `retainedEvents`. Ela é
limitada porque um histórico ilimitado é vazamento de memória em uma aba de vida
longa.

---

## 9. Hooks

```ts
const client = createClient({
  name: 'designer',
  schema,
  hooks: {
    beforeWrite: (context) => ({ ...(context.record as Design), updatedAt: Date.now() }),
    afterCommit: (events) => telemetry.record(events.length),
    afterRollback: (outcome, reason) => telemetry.warn(outcome, reason)
  }
});
```

### `beforeWrite(context) => substituto | void`

Roda dentro da transação, antes de a escrita ser emitida.

- Retorne um registro para **transformar** o que será escrito.
- Não retorne nada para deixá-lo inalterado.
- **Lance para vetar**: a transação aborta e nada é escrito.

`context` é `{ store, type, key?, record?, correlationId }`.

**Precisa ser síncrono.** A assinatura força isso, e uma promise retornada é
rejeitada em tempo de execução com explicação — porque aguardar qualquer coisa
aqui já teria fechado a janela de auto-commit da transação.

Não roda para `delete`, que não carrega registro.

### `afterCommit(events) => void`

Roda depois de os dados estarem duráveis, com eventos **congelados**. Não pode
reescrever o histórico para assinantes que ainda não rodaram, e uma exceção não
faz a chamada falhar — a escrita está em disco, e reportar o contrário causa
escritas duplicadas em nova tentativa.

### `afterRollback(outcome, reason) => void`

`outcome` é `'rolled-back'` ou `'unknown'`. São mantidos distintos porque apenas
o segundo precisa de reconciliação.

### O que hooks não podem fazer

Não existe `onError` devolvendo resultado substituto. Um hook pode vetar
ruidosamente; não pode observar uma falha e reportar sucesso no lugar.

---

## 10. Erros

Erros são **dado puro com discriminante**, não subclasses de `Error`, porque o
clone estruturado remove protótipos ao cruzar armazenamento e fronteiras de
worker — uma verificação `instanceof` passaria a retornar `false`
silenciosamente.

```ts
import { isCanaError, isCanaErrorCode } from '@jumentix/cana';

try {
  await designs.add(record);
} catch (error) {
  if (isCanaErrorCode(error, 'QuotaExceeded')) {
    await freeSomeSpace();
  } else if (isCanaErrorCode(error, 'ConstraintViolation')) {
    showDuplicateMessage();
  } else if (isCanaError(error)) {
    report(error.code, error.message, error.cause);
  }
}
```

### `CanaError`

```ts
{
  canaError: true,
  code: CanaErrorCode,
  message: string,
  retryable: boolean,
  store?: string,
  key?: CanaKey,
  cause?: string
}
```

### Códigos

| Código | Significado | Retentável |
|---|---|---|
| `Unavailable` | Sem IndexedDB utilizável. Terminal — não há fallback | não |
| `QuotaExceeded` | Orçamento de armazenamento esgotado; a escrita não aconteceu | **não** |
| `Evicted` | Um banco que existia sumiu | não |
| `UpgradeFailed` | Atualização não concluída, ou downgrade recusado | não |
| `UpgradeBlocked` | Outra conexão segura uma mudança de versão | **sim** |
| `ConstraintViolation` | Unicidade rejeitou a escrita | não |
| `NotFound` | Chave, índice ou cursor reproduzível inexistente | não |
| `TransactionAborted` | Abortada por quem chamou ou pelo motor | **sim** |
| `TransactionInactive` | A janela de auto-commit fechou — veja §7 | não |
| `Cancelled` | Cancelada por quem chamou | não |
| `Backpressure` | Uma fila limitada recusou em vez de crescer | **sim** |
| `UnknownOutcome` | O resultado não pode ser determinado — veja §12 | não |
| `InvalidRequest` | Requisição malformada, rejeitada antes do armazenamento | não |
| `Internal` | Não classificado; `cause` carrega o original | não |

`QuotaExceeded` deliberadamente **não** é retentável: repetir uma escrita que não
coube não fará caber, e marcá-la como retentável convida um laço que gasta
bateria e nunca converge. Liberar espaço é outra operação.

---

## 11. Armazenamento, cota e despejo

### Perguntando em que estado você está

```ts
const health = await client.durabilityAssessment();

health.level               // 'lost' | 'at-risk' | 'best-effort' | 'durable'
health.evictionDetectable  // false quando um apagamento seria invisível
health.summary             // linguagem simples, adequada a um usuário
health.advice              // readonly string[]
```

| Nível | Significado | O que fazer |
|---|---|---|
| `lost` | Os dados estavam lá e sumiram | **Avise o usuário.** Não mostre um app vazio que parece instalação nova |
| `at-risk` | Perto da cota; o navegador pode despejar | Libere espaço, exporte o que for crítico |
| `best-effort` | Não persistente, ou não confirmável | Trate os dados locais como cache |
| `durable` | Armazenamento persistente concedido | Nada |

`requiresUserAttention(level)` é verdadeiro para `lost` e `at-risk`.

### `'unknown'` não é `durable`

`storageState().persistent` é `true`, `false` ou `'unknown'`. O terceiro
significa que a Storage API não está disponível — o que não é evidência de
durabilidade. Mapeia para `best-effort`, com mensagem distinguindo "o navegador
recusou" de "não conseguimos saber".

### Pedindo persistência

```ts
await client.storageState();   // verifique antes

const client = createClient({
  ...,
  durabilityPolicy: { requestPersistenceOnOpen: true }
});
```

Padrão **desligado**. Alguns navegadores perguntam ao usuário, e um pedido
disparado por uma biblioteca em um momento arbitrário é um pedido que o usuário
nega — negativa com a qual a origem pode ficar presa. Pergunte em um momento que
seu usuário entenda.

### Detecção de despejo

Um banco despejado e um recém-criado abrem vazios do mesmo jeito. O Cana grava
uma lápide no `localStorage` — **apenas como marcador, nunca como armazenamento
alternativo** — para que uma abertura vazia posterior seja reconhecível como
perda.

Onde nenhuma lápide pode ser gravada (navegação privada lança em `localStorage`
em alguns navegadores), `evictionDetectable` é `false`. Isso é reportado em vez
de ser mascarado como "não despejado".

```ts
const health = await client.durabilityAssessment();
if (health.level === 'lost') {
  showDataLossNotice(health.summary);
  await resyncFromServer();          // se você tiver servidor
}
```

---

## 12. Recuperação de falhas

Escritas têm **três** resultados, não dois:

```ts
type CanaWriteOutcome = 'committed' | 'rolled-back' | 'unknown';
```

`unknown` significa que uma transação foi desmontada sem completar nem abortar de
forma observável — worker morto, aba fechada, navegador encerrado à força no meio
da gravação. Reportar como falha arrisca escrita duplicada na nova tentativa;
reportar como sucesso arrisca alegar dados que nunca foram gravados.

### Tornando-o resolvível

```ts
const client = createClient({ name: 'designer', schema, operationLedger: true });
```

O id da operação passa a ser gravado **dentro da mesma transação que os dados**,
de modo que a atomicidade do próprio IndexedDB garante que confirmem juntos.

```ts
const { outcome, correlationId, attemptedAt } = await client.transaction(...);

if (outcome === 'unknown') {
  await persistPendingOperation({ correlationId, attemptedAt });   // sobreviver à falha
}

// Após reiniciar:
const verdict = await client.resolveWrite(correlationId, attemptedAt);
// 'committed'    → pronto; não repita
// 'rolled-back'  → seguro repetir
// 'unresolvable' → a evidência foi podada; reconcilie com seus próprios dados
```

`unresolvable` é separado de `rolled-back` de propósito. Ambos parecem "o id não
está lá", mas um significa que a escrita definitivamente não aconteceu e o outro
que o registro envelheceu. Colapsá-los diria que é seguro repetir uma escrita que
já aconteceu.

### Ativando em um banco existente

O livro adiciona um store, então **você precisa aumentar a versão do schema**.
Ativá-lo sem isso falha em `open()` com `UpgradeFailed` e uma mensagem dizendo
para aumentar a versão — em vez de silenciosamente não registrar nada.

### Poda

```ts
import { pruneLedger, DEFAULT_LEDGER_HORIZON_MS } from '@jumentix/cana';

await pruneLedger(database, { horizonMs: DEFAULT_LEDGER_HORIZON_MS });  // padrão 24h
```

Uma exclusão por intervalo limitado sobre um índice de tempo, não uma varredura.

### Custo

Uma requisição extra por transação de escrita. Vem desligado por padrão porque só
compensa onde um worker ou aba pode de fato morrer no meio da escrita.

---

## 13. Exportação e importação

Sob a decisão de não haver fallback, a sua própria exportação é o único caminho
de recuperação que o usuário tem — por isso ela faz parte do contrato, não é
utilitário.

```ts
const dump = await client.exportAll();
// { designs: [...], deployments: [...] }

const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
```

A importação é código seu, então você controla a resolução de conflitos:

```ts
async function importAll(dump: Record<string, readonly unknown[]>) {
  const stores = Object.keys(dump);
  await client.transaction('readwrite', stores, async (scope) => {
    for (const store of stores) {
      await scope.table(store).bulkPut(dump[store]);
    }
  });
}
```

Ofereça exportação em algum lugar que o usuário alcance, especialmente quando
`durabilityAssessment()` reportar `at-risk`.

---

## 14. Uso com a factory de clientes Jumentix

A Jumentix suporta aplicações **100% offline, sem backend nenhum**. Para essas, o
IndexedDB não é caso de exceção — é o banco de dados, e `'IndexedDB'` é um driver
de primeira classe.

```ts
import { buildDatabaseClientCompilers } from '@jumentix/database-client-factory';
import { createCanaDatabaseClient } from '@jumentix/cana';

const compilers = buildDatabaseClientCompilers<IDatabaseClient>({
  inMemoryClient: InMemoryDbClient,
  indexedDbClient: () => createCanaDatabaseClient({ name: 'designer', schema })
});
```

Depois selecione como qualquer outro driver — `AAA_DATABASE_DRIVER=IndexedDB`, ou
`compileDatabaseClientByDriver('IndexedDB')`. Os apelidos `indexeddb`,
`indexed-db` e `cana` também resolvem.

Ele é **injetado** em vez de importado para que processos server-side que montam
um cliente Mongo não puxem um pacote browser-only para o grafo de dependências.

Selecioná-lo sem ligar `indexedDbClient`, ou em um runtime sem o global
`indexedDB`, lança com explicação. **Não** cai para in-memory: um app offline
rodando silenciosamente sobre um armazenamento que some com a aba pareceria
saudável e perderia tudo.

### A forma do adaptador

```ts
const database = createCanaDatabaseClient({ name: 'designer', schema });

await database.connect();               // abre
database.stores.designs                 // CanaTable, chaveado pelos nomes do schema
database.cana                           // o cliente completo, para transações etc.
database.subscribe(listener);
await database.disconnect();
```

`stores` é derivado do schema, então os dois não podem divergir.

---

## 15. Workers

O `@jumentix/cana` fornece os contratos de mensagem e o roteador de requisições
para rodar o motor em um worker.

```ts
import { createRouter } from '@jumentix/cana';

const router = createRouter({
  port: worker,
  timeoutMs: 15_000,
  onBroadcast: (event) => applyChange(event)
});

const rows = await router.send({ kind: 'query', store: 'designs' });
```

- Requisições carregam ids; respostas são pareadas por id, nunca por ordem de
  chegada.
- Uma **escrita** que estoura o tempo rejeita com `UnknownOutcome` — ela pode ter
  confirmado, então resolva contra o livro em vez de repetir às cegas.
- Uma **leitura** que estoura o tempo rejeita com `Unavailable`; não mudou nada.
- `router.abandonAll(reason)` falha tudo que está em voo, para um worker
  reconhecidamente morto.
- Cargas precisam ser clonáveis por estrutura. Funções e instâncias de classe
  rejeitam com `InvalidRequest`, e essa requisição nunca chegou ao worker.

> **Situação:** o protocolo e o roteador estão implementados e testados; um host
> de worker que roda o motor dentro de um `Worker` real ainda não faz parte deste
> pacote.

---

## 16. Testando seu próprio código

O Cana aceita um `IDBFactory`, então os testes não precisam de navegador:

```bash
bun add -d fake-indexeddb
```

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createClient } from '@jumentix/cana';

function testClient() {
  // Uma factory nova por teste, para que estado de banco não vaze entre eles.
  return createClient({ name: 'designer', schema, factory: new IDBFactory() });
}
```

Injete durabilidade para controlar despejo e cota:

```ts
import { StorageDurability } from '@jumentix/cana';

const durability = new StorageDurability({
  estimate: async () => ({ usage: 95, quota: 100 }),   // perto da cota
  persisted: async () => true
});

const client = createClient({ ..., durability });
```

Repare no que o `fake-indexeddb` **não** dá: cota real, despejo real,
`navigator.storage` real, nem comportamento real entre navegadores. Teste sua
lógica contra ele; não conclua que seu app lida com disco cheio.

---

## 17. Resolução de problemas

**`TransactionInactive`, e a linha parece correta**
Você aguardou algo que não é requisição IndexedDB dentro da transação. Veja §7.
Mova o await externo para fora do escopo.

**Minha mudança de schema não fez nada**
Você não aumentou `version`. O IndexedDB aplica mudanças só quando ela aumenta.

**Meu store sumiu do schema mas continua no banco**
Por design. Stores nunca são removidos automaticamente — escreva uma migração
explícita.

**Minha mudança de índice não teve efeito**
Índices existentes são mantidos como estão. Renomeie para forçar reconstrução.

**`UpgradeBlocked`**
Outra aba segura a versão antiga. Escute `versionchange` na outra aba e feche lá.
É `retryable`.

**Tudo reporta `Unavailable`**
Sem IndexedDB utilizável — navegação privada em alguns navegadores, ou
armazenamento desabilitado. Não há fallback, por design. Avise o usuário em vez
de degradar silenciosamente.

**O despejo nunca é detectado**
`evictionDetectable` é `false` quando nenhuma lápide pode ser gravada. Verifique
`durabilityAssessment()`.

**`resolveWrite` sempre diz `unresolvable`**
`operationLedger` está desligado, ou foi ligado sem aumentar a versão do schema —
este segundo caso agora falha ruidosamente em `open()`.

**`bulkPut` reportou `created` numa linha que eu esperava como update**
Em um store outbound não há chave para sondar, então toda linha reporta
`created`.

**Uma consulta está lenta**
Chame `explain()`. Se `fullScan` for verdadeiro, adicione um índice ou um
intervalo.

---

## 18. Referência da API

### `createClient(options): Client`

| Opção | Tipo | Padrão | Significado |
|---|---|---|---|
| `name` | `string` | — | Nome do banco |
| `schema` | `CanaSchema` | — | Versão e stores |
| `factory` | `IDBFactory` | global | Injetado para testes |
| `durability` | `StorageDurability` | ambiente do navegador | Injetado para testes |
| `retainedEvents` | `number` | `1000` | Janela de eventos reproduzíveis |
| `originId` | `string` | aleatório | Identifica este cliente nos eventos |
| `hooks` | `CanaHooks` | — | Veja §9 |
| `durabilityPolicy` | `DurabilityPolicy` | veja §11 | Comportamento de persistência |
| `operationLedger` | `boolean` | `false` | Veja §12 |

### `Client`

| Membro | Retorna |
|---|---|
| `name` / `version` | `string` / `number` |
| `open()` / `close()` | `Promise<void>` |
| `table<T, K>(name)` | `CanaTable<T, K>` |
| `transaction(mode, stores, body)` | `Promise<CanaTransactionResult<T>>` |
| `subscribe(listener, options?)` | `() => void` |
| `storageState()` | `Promise<CanaStorageState>` |
| `durabilityAssessment()` | `Promise<DurabilityAssessment>` |
| `resolveWrite(correlationId, attemptedAt, options?)` | `Promise<ResolvedOutcome>` |
| `exportAll()` | `Promise<Record<string, readonly unknown[]>>` |

### `CanaTable<TRecord, TKey>`

| Método | Retorna |
|---|---|
| `get(key)` | `Promise<TRecord \| undefined>` |
| `add(record, key?)` / `put(record, key?)` | `Promise<CanaWriteResult>` |
| `update(key, changes)` / `delete(key)` / `clear()` | `Promise<CanaWriteResult>` |
| `bulkAdd` / `bulkPut` / `bulkDelete` | `Promise<CanaBulkWriteResult>` |
| `count(query?)` | `Promise<number>` |
| `query(query?)` | `Promise<readonly TRecord[]>` |
| `explain(query?)` | `Promise<{ records; plan }>` |

### Funções avulsas

| Função | Propósito |
|---|---|
| `isCanaError` / `isCanaErrorCode` | Estreitar uma rejeição |
| `validateSchema` / `keyStrategyOf` | Inspecionar um schema |
| `planQuery` / `toKeyRange` | Inspecionar uma consulta sem executá-la |
| `assessDurability` / `requiresUserAttention` | Política de armazenamento |
| `classifyOpen` / `browserStorageEnvironment` | Primitivas de despejo |
| `pruneLedger` / `resolveOutcome` | Manutenção do livro |
| `createRouter` | Mensageria de worker |
| `createCanaDatabaseClient` | Adaptador Jumentix |

---

## Relacionados

- [CANA-INDEXEDDB-ADAPTER.pt-BR.md](./CANA-INDEXEDDB-ADAPTER.pt-BR.md) —
  fundamentação de projeto e a lista do que **ainda não** foi comprovado. Leia
  antes de depender disto em produção.
- README do pacote: `packages/cana/README.md`
