# Cana — Adaptador de Banco de Dados Offline sobre IndexedDB

`@jumentix/cana` é um motor IndexedDB próprio para aplicações offline-first da
Jumentix. Não é um invólucro sobre uma biblioteca existente. Quando o IndexedDB
não abre, ele pode degradar para um backend **explícito** em localStorage
(JUM-615).

Este documento registra o que ele faz, o que se recusa deliberadamente a fazer e
o que a suite de testes comprovou. Um banco offline que exagera suas garantias
é pior do que um que não oferece nenhuma.

---

## 1. A decisão que molda tudo: IndexedDB preferido, fallback explícito

IndexedDB é o store principal. Depois de um `open()` bem-sucedido,
`client.backend` é `'indexeddb'` ou `'localStorage'`.

Quando o IndexedDB não está disponível — navegação privada em alguns
navegadores, ambiente hostil, armazenamento desabilitado — o Cana abre por
padrão um store em localStorage (`ClientOptions.fallback: 'localStorage'`). Esse
modo é **degradado e visível**: cota menor, sem índices reais, avaliação de
durabilidade `best-effort`. Passe `fallback: false` para manter o `Unavailable`
terminal pré-JUM-615.

O fallback nunca é silencioso e nunca faz dual-write com IndexedDB. Evita-se
split-brain escolhendo um backend por sessão; mova dados com `exportAll()` /
import ao promover de volta para IndexedDB.

---

## 2. Arquitetura

```
contracts.ts     a fronteira congelada — nenhum tipo do IndexedDB a atravessa
  errors.ts      tradução de DOMException para CanaError
  schema.ts      validação e aplicação não destrutiva
  storage.ts     detecção de despejo, observação de cota
  database.ts    abrir / atualizar / fechar / excluir
  transaction.ts fronteira de commit, resultado de três estados, buffer de eventos
  query.ts       planejamento e execução por cursor
  table.ts       CRUD e operações em lote
  hooks.ts       beforeWrite / afterCommit / afterRollback
  client.ts      monta tudo acima no CanaClient
  reconciliation.ts  o livro de operações, resolvendo o `unknown`
  protocol.ts    contratos de mensagem do worker e o roteador de requisições
  durability-policy.ts  o que a aplicação pode dizer ao usuário
```

### Tudo é dado puro

`CanaError` não é uma subclasse de `Error`. `CanaChangeEvent` não é uma classe.
Isso decorre de uma propriedade que foi **medida, não presumida** — existe um
teste que a verifica:

> Um registro lido de volta do IndexedDB não carrega o `Object.prototype` do
> realm que o leu. Ele é um clone estruturado.

A identidade de classe não sobrevive à ida e volta, nem à fronteira do worker.
Qualquer verificação `instanceof` contra dados armazenados ou transferidos passa
a retornar `false` silenciosamente. Por isso o discriminante é um campo:
`canaError: true`, verificado por `isCanaError()`.

---

## 3. Os comportamentos que são decisões

Cada um destes é um caso em que a implementação óbvia é a errada.

### 3.1 Três resultados de escrita, não dois

`CanaWriteOutcome` é `committed | rolled-back | unknown`.

`unknown` cobre uma transação desmontada sem que `complete` nem `abort` tenham
disparado — um worker morto, uma aba fechada, um navegador encerrado à força no
meio da gravação. Um resultado de dois estados obriga esse caso a ser reportado
como uma das duas coisas que ele não é, e quem reconcilia depois acaba perdendo
uma escrita confirmada ou duplicando outra.

### 3.2 `unknown` é resolvível, não apenas honesto

Reportar a ambiguidade é melhor do que mentir sobre ela, mas a ambiguidade ainda
precisa ser resolvida. Com `operationLedger: true`, o id da operação é gravado
**dentro da mesma transação que os dados**. O IndexedDB garante atomicidade de
transação, logo o armazenamento não pode confirmar um sem o outro, e depois:

| estado do livro | significado |
|---|---|
| id presente | a escrita foi confirmada |
| id ausente, tentada dentro do horizonte | não foi confirmada |
| id ausente, tentada antes do horizonte | `unresolvable` — o registro pode ter sido podado |

A terceira linha importa. Colapsar `unresolvable` em `rolled-back` diria a quem
chamou que é seguro repetir uma escrita que já aconteceu.

```ts
const outcome = await client.resolveWrite(correlationId, attemptedAt);
```

### 3.3 Eventos de mudança ficam em buffer até o commit

Os eventos são coletados durante a transação e liberados somente após
`oncomplete`. Emiti-los conforme as escritas acontecem anunciaria mudanças que um
abort posterior desfaz, e um assinante que já agiu sobre um evento fantasma não
pode ser instruído a desagir.

### 3.4 A aplicação do schema é aditiva, nunca destrutiva

Um store presente no banco mas ausente do schema é **deixado em paz**.
`deleteObjectStore` destrói dados do usuário de forma irreversível; fazer isso
automaticamente porque um store sumiu de um literal de schema significa que um
erro de digitação apaga uma tabela. Remoção é migração explícita, nunca
inferência.

### 3.5 `update` não insere

`update(key, changes)` em uma chave inexistente falha com `NotFound`. Um upsert
com nome de update ressuscita registros que outra aba excluiu. Quem quer upsert
usa `put`.

### 3.6 O motor é dono da fronteira transacional

Não existe `commit()`. Uma transação IndexedDB confirma sozinha assim que o event
loop cede sem requisições pendentes, então `await fetch(...)` dentro de um escopo
não pausa a transação — ele a *encerra*. Expor `commit()` sugeriria controle
sobre um tempo de vida que quem chama não controla.

**A regra de uso:** aguardar uma requisição do IndexedDB dentro de uma transação
é seguro (a promise resolve em um microtask, antes de a tarefa ceder). Aguardar
qualquer outra coisa é fatal. O Cana reporta a violação como
`TransactionInactive` com uma mensagem que diz isso.

### 3.7 Hooks dentro da transação são síncronos por assinatura

`beforeWrite` retorna um valor, nunca uma promise, pelo motivo acima. Há também
uma verificação em tempo de execução, porque quem chama em JavaScript não tem
compilador.

Um hook **não pode engolir uma falha** — não existe `onError` que devolva um
resultado substituto. Lançar em `beforeWrite` veta a escrita e aborta a
transação. `afterCommit` recebe eventos congelados e uma exceção ali não faz a
chamada falhar: os dados já estão em disco.

### 3.8 Consultas publicam seu plano

```ts
const { records, plan } = await table.explain({ index: 'byOwner', equals: 'ana' });
// plan.usedIndex === 'byOwner', plan.fullScan === false
```

Uma implementação que lê tudo para um array e filtra passa em todos os testes de
correção e desmorona com 100 mil registros. `explain()` transforma "usou o
índice" e "aplicou o offset no cursor" em algo verificável por teste, em vez de
uma propriedade que se toma por confiança.

### 3.9 Despejo não é primeira execução

Um banco despejado e um recém-criado abrem vazios do mesmo jeito. O Cana grava
uma lápide no `localStorage` **apenas como marcador, nunca como armazenamento
alternativo** — para que uma abertura vazia posterior seja reconhecível como
perda. Onde nenhuma lápide pode ser gravada, o veredito é
`undetectable-no-tombstone`, reportado como tal em vez de como "não despejado".

### 3.10 Durabilidade nunca é arredondada para cima

`persistent: 'unknown'` **não** é `durable`. `assessDurability()` retorna
`lost | at-risk | best-effort | durable`, e `'unknown'` vira `best-effort` com
uma mensagem dizendo que a persistência não pôde ser confirmada — distinta de
`false`, que diz que o navegador recusou. Nenhuma das duas é garantia.

`requestPersistenceOnOpen` tem padrão `false`: um pedido de persistência disparado
por uma biblioteca em um momento arbitrário é um pedido que o usuário nega, e
alguns navegadores tornam essa negativa permanente para a origem.

---

## 4. Uso

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }
    ]
  },
  operationLedger: true
});

await client.open();

await client.table('designs').add({ id: 1, name: 'first', owner: 'ana' });

const { outcome, events } = await client.transaction(
  'readwrite',
  ['designs'],
  async (scope) => {
    await scope.table('designs').put({ id: 2, name: 'second', owner: 'bruno' });
  }
);

const stop = client.subscribe((event) => console.log(event.type), { sinceCursor: 0 });

const health = await client.durabilityAssessment();
if (health.level === 'lost') {
  // Avise o usuário. NÃO mostre um app vazio que parece uma instalação nova.
}
```

---

## 5. Comprovado vs lacunas restantes (JUM-615)

Declarado sem rodeios, porque os testes existentes poderiam ser confundidos com
uma cobertura maior do que realmente representam.

| Área | Situação |
|---|---|
| Ciclo de vida, CRUD, consultas, transações, eventos, hooks, livro no IndexedDB real do browser | **Testado** — suite Cypress do Cana (Requirement 112 §4) |
| Matriz entre navegadores (Chrome / Firefox / WebKit) | **Testado** onde a matriz de CI executa esses engines (JUM-417 / JUM-581) |
| Fallback localStorage quando IndexedDB indisponível | **Testado** — `cypress/localstorage-fallback.cy.ts` + conformance (JUM-615) |
| Hosting em `Worker` dedicado | **Testado** — `cypress/real-worker.cy.ts` (JUM-615) |
| Worker morto → timeout / pedidos em voo irresolutos | **Testado** — caminho `terminate` do Worker real |
| Desempenho de consultas em escala | **Não medido.** `explain()` prova o plano, não o custo de parede |
| Esgotamento real de cota em origem cheia | Política e mapeamento testados; encher cota real em CI não |

### Sobre o Dexie (JUM-399 — encerrado)

O Cana é uma implementação independente. Não compartilha código com o Dexie, e
nenhum fonte do Dexie é embutido, empacotado ou referenciado por este pacote.

O dono do projeto determinou que nenhuma restrição de licenciamento se aplica ao
Cana e encerrou o JUM-399 com base nisso. Isto fica registrado como decisão do
dono; não é uma análise jurídica do agente de engenharia que escreveu este
código, que não tem qualificação para emiti-la.

Se o Dexie vier a ser usado para comparação — o harness diferencial do JUM-561 é
o único caso previsto — ele entra como dependência comum de desenvolvimento sob
os próprios termos Apache-2.0, e nada dele é copiado para dentro deste pacote.

## 6. Requisitos relacionados

- Requisito `015`/`016` — fronteiras hexagonais
- Requisito `065` — fail-closed, sem falsos verdes
- Requisito `076` — documentação bilíngue
- Requisito `094` — portão de conclusão de documentação do épico
- `.agents/NFR-REGISTRY.md` — NFRs de durabilidade e desempenho

Guia de uso: [CANA-USAGE-GUIDE.pt-BR.md](./CANA-USAGE-GUIDE.pt-BR.md)

Inglês: [CANA-INDEXEDDB-ADAPTER.md](./CANA-INDEXEDDB-ADAPTER.md)
