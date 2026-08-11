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
```
