# @jumentix/dead-letter-queue

Fila privada para transações recusadas pelo mutex (JUM-53).

## Porquê

O `UserService` recusa uma escrita quando o mutex reporta o recurso já
bloqueado, em doze pontos com esta forma:

```ts
const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
if (previouslyLocked) await this.rejectLocked('update', id, data);
```

Antes deste pacote o chamador recebia um erro e a transação pretendida era
descartada. Uma escrita perdida por contenção era indistinguível de uma que
nunca foi tentada. Isto regista a tentativa para que possa ser reexecutada.

**Uma escrita em fila não aconteceu.** O serviço continua a lançar
`ResourceLockedError`. Reportar sucesso para uma escrita em fila seria pior do
que perdê-la.

## Contrato

`new DeadLetterQueue({ store, maxAttempts, now, newId })`

- `enqueue(input)` guarda `{ entityName, resourceId, operation, payload, actorId? }`
  como registo `pending` e devolve-o.
- `pending()` devolve os registos reexecutáveis, na ordem em que foram recusados.
- `find(id)` devolve um registo qualquer que seja o seu estado.
- `replay(handlers)` drena os registos pendentes uma vez, um handler por
  `operation`, e reporta `{ replayed, retried, abandoned, skipped }`.

Um handler que retorna normalmente significa que a escrita aconteceu. Lançar
significa que não aconteceu, e o registo continua reexecutável até
`maxAttempts` (por omissão 5), a partir do qual fica `abandoned` e nunca mais é
escolhido. Um registo cuja operação não tem handler é **skipped**, não
abandonado: um handler em falta é um erro de ligação no processo, e descartar o
registo por causa disso perderia exatamente os dados que isto existe para
guardar.

Registos terminais são mantidos em vez de apagados, para que "essa escrita
chegou a acontecer?" continue a ter resposta depois do facto.

## O worker de replay

`new DeadLetterReplayWorker({ queue, handlers, intervalMs, onReport, onError })`

`start()` drena no intervalo (por omissão 30s), `stop()` termina, `tick()` força
uma drenagem. O timer leva `unref`, para que uma drenagem em fundo nunca segure
uma CLI ou um test runner vivos.

Três propriedades, cada uma um modo de um ciclo de timer ingénuo correr mal:

- **Sem sobreposição.** Uma drenagem mais lenta que o intervalo não recomeça
  enquanto a anterior corre, ou o mesmo registo é reexecutado duas vezes em
  simultâneo.
- **Uma drenagem que falha não mata o worker.** Redis em baixo é um tick mau,
  não o fim. Um worker que morre ao primeiro erro é indistinguível de um que
  nunca arrancou.
- **Parar é completo.** Nenhum tick corre depois de `stop()`.

No `apps/backend-template`, `composeUserDeadLetterReplay.ts` constrói os
handlers a partir do `UserService`. O replay passa **pelo serviço**, não pelo
repositório, logo readquire o mutex: um registo cujo lock não libertou é
recusado outra vez e continua em fila. Um replay ao nível do repositório
escreveria por cima do lock.

Esse ficheiro carrega também o ponto mais subtil do desenho: o `UserService`
reporta falha em `response.error` e não lança. Um handler que ignorasse isso
retornaria normalmente para um registo ainda bloqueado, a fila marcaria
`succeeded`, e a escrita perder-se-ia com o relatório a dizer que passou. Todos
os handlers passam por `orThrow`.

## Stores

- `InMemoryDeadLetterStore` — local ao processo, para testes e runtimes de
  processo único.
- `KeyValueDeadLetterStore(client, { prefix })` — Redis, através do mesmo
  cliente `get`/`set`/`del` que o mutex usa. Esse cliente não tem `SCAN` nem
  `KEYS`, por isso a store mantém um índice explícito dos ids sob uma chave.

## Ligação

Passar a fila como serviço; sem ela o comportamento é exatamente o anterior.

```ts
new UserService({
  dataRepository,
  services: { mutexService, passwordCryptoService, deadLetterQueue }
});
```

Uma falha da fila é engolida no ponto de chamada e registada em log: "o recurso
está bloqueado" continua a ser a resposta verdadeira ao chamador,
independentemente de o registo ter sido guardado, e reportar uma falha do Redis
a quem apanhou contenção esconderia a causa.

## Validação

```bash
bun run --filter @jumentix/dead-letter-queue build
bun run --filter @jumentix/dead-letter-queue typecheck
bun run --filter @jumentix/dead-letter-queue lint
bun run --filter @jumentix/dead-letter-queue test
bun run smoke:dead-letter:redis   # contra um contentor Redis real
```

A suite de integração salta-se a si própria sem `RUN_REDIS_INTEGRATION=1` em vez
de passar, porque uma suite que reporta sucesso sem a sua dependência é o
falso-verde que este repositório continua a encontrar.
