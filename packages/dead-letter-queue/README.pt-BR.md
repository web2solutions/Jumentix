# @jumentix/dead-letter-queue

Fila privada para transações recusadas pelo mutex (JUM-53).

> **Uma escrita em fila não aconteceu.** Tudo neste pacote decorre dessa frase.
> O serviço continua a lançar `ResourceLockedError`; a fila apenas torna a
> tentativa recuperável.

---

## 1. O problema

O `UserService` protege cada mutação com o mutex. Quando o recurso já está
bloqueado, recusa:

```ts
const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
if (previouslyLocked) await this.rejectLocked('update', id, data);
```

São **doze** pontos assim. Antes deste pacote, o chamador recebia um erro e a
transação pretendida era descartada. Nada registava que tinha sido tentada, por
isso uma escrita perdida por contenção era indistinguível de uma escrita que
ninguém chegou a fazer.

<svg viewBox="0 0 720 300" role="img" aria-label="Before JUM-53 the refused write disappeared; after JUM-53 it is recorded and still refused" width="720" height="300" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35">
    <line x1="90" y1="46" x2="90" y2="285"/>
    <line x1="270" y1="46" x2="270" y2="285"/>
    <line x1="450" y1="46" x2="450" y2="285"/>
    <line x1="630" y1="46" x2="630" y2="285"/>
  </g>
  <g font-size="13" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="90" y="26" font-weight="600">Client</text>
    <text x="270" y="26" font-weight="600">UserService</text>
    <text x="450" y="26" font-weight="600">MutexService</text>
    <text x="630" y="26" font-weight="600">DeadLetterQueue</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" marker-end="url(#dlq-arrow)" fill="none">
    <line x1="90" y1="70" x2="264" y2="70"/>
    <line x1="270" y1="105" x2="444" y2="105"/>
    <line x1="450" y1="135" x2="276" y2="135" stroke-dasharray="5 4"/>
    <line x1="270" y1="196" x2="96" y2="196" stroke-dasharray="5 4"/>
    <line x1="270" y1="246" x2="624" y2="246"/>
    <line x1="270" y1="276" x2="96" y2="276" stroke-dasharray="5 4"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor">
    <text x="100" y="64">update(user-1, payload)</text>
    <text x="280" y="99">lock(User, user-1)</text>
    <text x="286" y="129">previouslyLocked = true</text>
    <text x="106" y="190">ResourceLockedError</text>
    <text x="280" y="240">enqueue(User, user-1, update, payload)</text>
    <text x="106" y="270">ResourceLockedError</text>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.75">
    <rect x="60" y="160" width="620" height="46" rx="6" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity="0.5"/>
    <text x="66" y="176">before JUM-53 — the attempt disappeared</text>
    <rect x="60" y="216" width="620" height="70" rx="6" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity="0.5"/>
    <text x="66" y="232">after JUM-53 — recorded, and still refused</text>
  </g>
</svg>

O cliente é recusado nos **dois** caminhos. É esse o ponto: a escrita não
aconteceu, e um cliente informado do contrário agiria sobre uma mentira.

---

## 2. As peças

<svg viewBox="0 0 720 300" role="img" aria-label="UserService enqueues into DeadLetterQueue; the replay worker drains it back through the service; stores are in-memory or Redis" width="720" height="300" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow2" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4">
    <rect x="16" y="20" width="200" height="150" rx="8" stroke-dasharray="5 4"/>
    <rect x="270" y="20" width="240" height="260" rx="8" stroke-dasharray="5 4"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.7">
    <text x="26" y="38">apps/backend-template</text>
    <text x="280" y="38">@jumentix/dead-letter-queue</text>
  </g>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="32" y="52" width="168" height="44" rx="6"/>
    <rect x="32" y="112" width="168" height="44" rx="6"/>
    <rect x="288" y="52" width="200" height="44" rx="6"/>
    <rect x="288" y="118" width="200" height="44" rx="6"/>
    <rect x="288" y="184" width="90" height="42" rx="6"/>
    <rect x="396" y="184" width="92" height="42" rx="6"/>
    <rect x="566" y="184" width="130" height="42" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="116" y="70">UserService</text><text x="116" y="86" font-size="10" opacity="0.8">12 rejection sites</text>
    <text x="116" y="130">composeUserDeadLetterReplay</text><text x="116" y="146" font-size="10" opacity="0.8">handlers + wiring</text>
    <text x="388" y="70">DeadLetterQueue</text><text x="388" y="86" font-size="10" opacity="0.8">enqueue · pending · replay</text>
    <text x="388" y="136">DeadLetterReplayWorker</text><text x="388" y="152" font-size="10" opacity="0.8">interval drain</text>
    <text x="333" y="203">InMemory</text><text x="333" y="217" font-size="10" opacity="0.8">Store</text>
    <text x="442" y="203">KeyValue</text><text x="442" y="217" font-size="10" opacity="0.8">Store</text>
    <text x="631" y="210">Redis</text>
  </g>
  <g stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#dlq-arrow2)">
    <line x1="200" y1="70" x2="282" y2="70"/>
    <line x1="388" y1="118" x2="388" y2="100"/>
    <line x1="333" y1="162" x2="333" y2="178"/>
    <line x1="442" y1="162" x2="442" y2="178"/>
    <line x1="488" y1="205" x2="560" y2="205"/>
    <path d="M288 140 C 240 140, 210 120, 200 118"/>
  </g>
  <g font-size="10" font-family="inherit" fill="currentColor" opacity="0.85">
    <text x="206" y="64">rejectLocked()</text>
    <text x="206" y="112">handlers call back</text>
    <text x="494" y="200">get · set · del</text>
  </g>
</svg>

| Peça | Responsabilidade |
|---|---|
| `DeadLetterQueue` | Registos, estados, limite de tentativas, ordem de replay |
| `DeadLetterReplayWorker` | Chama `replay` num intervalo, sem sobreposição |
| `InMemoryDeadLetterStore` | Local ao processo; testes e runtimes de processo único |
| `KeyValueDeadLetterStore` | Redis, através do cliente que o mutex já usa |
| `composeUserDeadLetterReplay` | Mapeia nomes de operação de volta para métodos do `UserService` |

---

## 3. O ciclo de vida do registo

<svg viewBox="0 0 720 220" role="img" aria-label="A record starts pending, becomes succeeded when a handler wrote, retries while under the attempt bound, and is abandoned at the bound" width="720" height="220" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow3" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="52" cy="110" r="10"/>
    <rect x="140" y="86" width="140" height="48" rx="24"/>
    <rect x="420" y="26" width="150" height="48" rx="24"/>
    <rect x="420" y="146" width="150" height="48" rx="24"/>
  </g>
  <g font-size="13" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="210" y="115">pending</text>
    <text x="495" y="55">succeeded</text>
    <text x="495" y="175">abandoned</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" fill="none" marker-end="url(#dlq-arrow3)">
    <line x1="64" y1="110" x2="134" y2="110"/>
    <path d="M280 100 C 340 100, 370 60, 414 52"/>
    <path d="M280 122 C 340 122, 370 160, 414 168"/>
    <path d="M180 86 C 175 50, 245 50, 240 84"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor">
    <text x="72" y="102">enqueue()</text>
    <text x="300" y="80">handler returned</text>
    <text x="300" y="150">bound reached</text>
    <text x="150" y="46">handler threw, under the bound</text>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.75">
    <text x="140" y="212">Terminal records are kept, not deleted: "did that write ever happen" must stay answerable.</text>
  </g>
</svg>

| Estado | Significado | Escolhido pelo `replay`? |
|---|---|---|
| `pending` | Recusada, reexecutável | sim |
| `succeeded` | Um handler executou a escrita | não |
| `abandoned` | Limite de tentativas atingido | nunca |

---

## 4. O replay passa pelo serviço

Esta é a decisão com maior probabilidade de ser mal feita, por isso vale ser explícito.

<svg viewBox="0 0 720 250" role="img" aria-label="Replay calls the service, which re-acquires the mutex; a cleared lock marks the record succeeded, a held lock counts an attempt and keeps it pending" width="720" height="250" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow4" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="16" y="98" width="120" height="44" rx="6"/>
    <rect x="176" y="98" width="140" height="44" rx="6"/>
    <rect x="356" y="98" width="150" height="44" rx="6"/>
    <rect x="546" y="26" width="158" height="52" rx="6"/>
    <rect x="546" y="162" width="158" height="52" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="76" y="124">ReplayWorker</text>
    <text x="246" y="118">handler</text><text x="246" y="134" font-size="10" opacity="0.8">orThrow</text>
    <text x="431" y="118">UserService</text><text x="431" y="134" font-size="10" opacity="0.8">re-acquires the mutex</text>
    <text x="625" y="48">lock cleared</text><text x="625" y="66" font-size="10" opacity="0.85">status = succeeded</text>
    <text x="625" y="184">still locked</text><text x="625" y="202" font-size="10" opacity="0.85">attempts + 1, stays pending</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" fill="none" marker-end="url(#dlq-arrow4)">
    <line x1="136" y1="120" x2="170" y2="120"/>
    <line x1="316" y1="120" x2="350" y2="120"/>
    <path d="M506 110 C 526 108, 530 70, 540 60"/>
    <path d="M506 130 C 526 132, 530 170, 540 180"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.8">
    <text x="16" y="240">Through the service, never the repository: a repository-level replay would write past the lock.</text>
  </g>
</svg>

Duas coisas que este diagrama defende:

**Pelo serviço, não pelo repositório.** O serviço readquire o mutex, por isso um
registo cujo lock não libertou é recusado outra vez e continua em fila. Um replay
ao nível do repositório escreveria *por cima* do lock, que é exatamente a
corrupção que o mutex existe para prevenir.

**`orThrow` não é decoração.** O `UserService` reporta falha em
`response.error` e **não** lança. Um handler que ignorasse isso retornaria
normalmente para um registo ainda bloqueado, a fila marcaria `succeeded`, e a
escrita perder-se-ia com o relatório a dizer que passou. Todos os handlers passam
por `orThrow`.

---

## 5. API

### `DeadLetterQueue`

```ts
new DeadLetterQueue({ store?, maxAttempts?, now?, newId? })
```

| Opção | Omissão | Notas |
|---|---|---|
| `store` | `InMemoryDeadLetterStore` | Usar `KeyValueDeadLetterStore` num runtime real |
| `maxAttempts` | `5` | Mínimo 1; uma fila que nunca tenta é recusada na construção |
| `now` | `() => new Date()` | Injetado para testes determinísticos |
| `newId` | timestamp + contador | O contador é o que evita colisão entre dois registos no mesmo milissegundo |

| Método | Devolve |
|---|---|
| `enqueue(input)` | O registo `pending` guardado |
| `pending()` | Registos reexecutáveis, por ordem de recusa |
| `find(id)` | Um registo, qualquer que seja o estado |
| `replay(handlers)` | `{ replayed, retried, abandoned, skipped }` — ids, não contagens |

O `enqueue` recusa entrada que não poderia ser reexecutada: `entityName`,
`resourceId` e `operation` são obrigatórios.

### `DeadLetterReplayWorker`

```ts
new DeadLetterReplayWorker({ queue, handlers, intervalMs?, onReport?, onError? })
```

| Membro | Comportamento |
|---|---|
| `start()` | Inicia o intervalo (omissão `30_000` ms). O timer leva `unref` |
| `stop()` | Termina; nenhum tick corre depois |
| `tick()` | Força uma drenagem — no shutdown, ou ao libertar um recurso |
| `running` | Se o intervalo está ativo |

Três propriedades, cada uma um modo de um ciclo de timer ingénuo correr mal:

- **Sem sobreposição.** Uma drenagem mais lenta que o intervalo não recomeça
  enquanto a anterior corre, ou o mesmo registo é reexecutado duas vezes em
  simultâneo.
- **Uma drenagem que falha não mata o worker.** Redis em baixo é um tick mau,
  não o fim. Um worker que morre ao primeiro erro é indistinguível de um que
  nunca arrancou.
- **Parar é completo**, incluindo um tick já agendado.

### Stores

| Store | Uso |
|---|---|
| `InMemoryDeadLetterStore` | Testes, runtimes de processo único |
| `KeyValueDeadLetterStore(client, { prefix })` | Redis, prefixo por omissão `dlq` |

O cliente Redis que este repositório usa expõe `get`, `set` e `del` — **sem
`SCAN`, sem `KEYS`**. Por isso a store mantém um índice explícito dos ids dos
registos sob uma chave, que é também o que preserva a ordem de replay.

<svg viewBox="0 0 720 170" role="img" aria-label="One index key holds the record ids in rejection order, each pointing at its own record key" width="720" height="170" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow5" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="16" y="56" width="220" height="56" rx="6"/>
    <rect x="380" y="10" width="300" height="38" rx="6"/>
    <rect x="380" y="66" width="300" height="38" rx="6"/>
    <rect x="380" y="122" width="300" height="38" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor">
    <text x="34" y="80" font-weight="600">dlq:index</text>
    <text x="34" y="98" font-size="11" opacity="0.85">id-1, id-2, id-3</text>
    <text x="398" y="34">dlq:record:id-1</text>
    <text x="398" y="90">dlq:record:id-2</text>
    <text x="398" y="146">dlq:record:id-3</text>
  </g>
  <g stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#dlq-arrow5)">
    <path d="M236 76 C 300 70, 320 40, 374 32"/>
    <line x1="236" y1="84" x2="374" y2="84"/>
    <path d="M236 92 C 300 98, 320 132, 374 140"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.85">
    <text x="252" y="52">1st</text><text x="286" y="78">2nd</text><text x="252" y="124">3rd</text>
  </g>
</svg>

---

## 6. Ligação

Passar a fila como serviço. Sem ela, o comportamento é **exatamente** o anterior.

```ts
import { composeUserDeadLetterQueue, composeUserDeadLetterWorker }
  from '@src/modules/Users/composition/composeUserDeadLetterReplay';

const deadLetterQueue = composeUserDeadLetterQueue(keyValueStorageClient);
const userService = UserService.compile({
  dataRepository,
  services: { mutexService, passwordCryptoService, deadLetterQueue }
});
const deadLetterWorker = composeUserDeadLetterWorker(deadLetterQueue, userService);
```

O `composeUsersAuthServices` já faz isto e devolve ambos. Constrói o worker mas
**não** o arranca: um timer em fundo é do runtime arrancar e, mais importante,
parar.

```ts
deadLetterWorker?.start();
process.on('SIGTERM', () => deadLetterWorker?.stop());
```

Sem `keyValueStorageClient` ambos ficam `undefined`, de propósito: uma fila local
ao processo perder-se-ia no restart parecendo durável.

---

## 7. Experimentar

Um script executável, sem Redis:

```bash
bun run --filter @jumentix/dead-letter-queue example
```

É o `examples/replay.ts` deste pacote — edita e volta a correr. Percorre o ciclo
todo: uma escrita recusada, um replay que falha porque o lock ainda se mantém, um
replay que passa, e um registo que atinge o limite de tentativas.

```ts
import { DeadLetterQueue } from '@jumentix/dead-letter-queue';

const queue = new DeadLetterQueue({ maxAttempts: 2 });
await queue.enqueue({
  entityName: 'User', resourceId: 'user-1', operation: 'update', payload: { firstName: 'Ada' }
});

let locked = true;
const handlers = {
  update: async () => { if (locked) throw new Error('User user-1 is locked'); }
};

await queue.replay(handlers); // retried: [ 'dlq-...' ]
locked = false;
await queue.replay(handlers); // replayed: [ 'dlq-...' ]
```

---

## 8. Operação

| Sintoma | O que significa | O que fazer |
|---|---|---|
| `pending()` cresce | Locks não libertam, ou o worker não arrancou | Verificar `worker.running` e o TTL do mutex |
| Registos chegam a `abandoned` | Um recurso ficou bloqueado durante `maxAttempts` drenagens | Ler `lastError`; a escrita perdeu-se e o registo é a prova |
| `skipped` num relatório | Uma operação não tem handler registado | Erro de ligação — o registo é mantido, não descartado |
| `onError` dispara | A própria drenagem falhou, por exemplo Redis em baixo | O worker continua a tiquetaquear; corrigir a store |

O relatório devolve **ids**, não contagens, para que um operador possa procurar o
registo em vez de inferir de um total.

---

## 9. Validação

```bash
bun run --filter @jumentix/dead-letter-queue build
bun run --filter @jumentix/dead-letter-queue typecheck
bun run --filter @jumentix/dead-letter-queue lint
bun run --filter @jumentix/dead-letter-queue test
bun run smoke:dead-letter:redis   # contra um contentor Redis real
```

A suite de integração **salta-se a si própria** sem `RUN_REDIS_INTEGRATION=1` em
vez de passar. Uma suite que reporta sucesso sem a sua dependência é o
falso-verde que este repositório continua a encontrar.

O que só o servidor real responde, e que essa suite portanto verifica: valores
voltam como strings e fazem parse, uma segunda fila sobre o mesmo servidor vê o
que a primeira escreveu, o índice mantém a ordem de recusa, o worker drena, e um
registo abandonado continua abandonado depois de reabrir.
