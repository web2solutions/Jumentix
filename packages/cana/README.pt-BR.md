# @jumentix/cana

Adaptador de banco de dados offline sobre IndexedDB para aplicações Jumentix.

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }
    ]
  }
});

await client.open();
await client.table('designs').add({ id: 1, name: 'first', owner: 'ana' });
```

## Três coisas a saber antes de usar

**Não existe fallback.** Se o IndexedDB não estiver disponível, o Cana reporta
`Unavailable` e para — ele não passa silenciosamente para `localStorage` ou
memória. Um fallback com durabilidade e capacidade diferentes continuaria
aceitando escritas e continuaria dizendo ao usuário que o trabalho dele foi
salvo, e a falha só apareceria muito longe da sua causa. Por isso `exportAll()`
faz parte do contrato, e não é uma conveniência: é o único caminho de
recuperação que o usuário tem.

**Escritas têm três desfechos, não dois.** `committed | rolled-back | unknown`.
O terceiro cobre uma transação derrubada sem que nenhum dos dois eventos
dispare — um worker morto, uma aba fechada. Ative `operationLedger: true` e
`resolveWrite()` responderá de forma definitiva, porque o id da operação é
gravado dentro da mesma transação que os dados.

**Nunca dê `await` em algo que não seja uma requisição do IndexedDB dentro de
uma transação.** A transação faz auto-commit assim que o event loop cede sem
requisições pendentes, então `await fetch(...)` não pausa a transação — ele a
encerra. O Cana reporta a violação como `TransactionInactive` em vez de deixar
uma `DOMException` crua escapar.

## Erros são dados puros

`CanaError` não é uma subclasse de `Error`, porque o structured clone não
preserva identidade de classe ao atravessar o armazenamento ou a fronteira de um
worker — uma verificação `instanceof` passaria a retornar `false` sem avisar.
Use os guards:

```ts
import { isCanaError, isCanaErrorCode } from '@jumentix/cana';

if (isCanaErrorCode(error, 'QuotaExceeded')) { /* ... */ }
```

## Documentação completa

**Guia de uso** — referência da API, consultas, transações, hooks, recuperação
de falhas, solução de problemas:

- English: [`CANA-USAGE-GUIDE.md`](../../documentation/md/CANA-USAGE-GUIDE.md)
- Português: [`CANA-USAGE-GUIDE.pt-BR.md`](../../documentation/md/CANA-USAGE-GUIDE.pt-BR.md)

**Racional de projeto** — por que cada comportamento é o que é, e o que ainda
não está comprovado:

- English: [`CANA-INDEXEDDB-ADAPTER.md`](../../documentation/md/CANA-INDEXEDDB-ADAPTER.md)
- Português: [`CANA-INDEXEDDB-ADAPTER.pt-BR.md`](../../documentation/md/CANA-INDEXEDDB-ADAPTER.pt-BR.md)

A seção "O que NÃO está comprovado" desse documento é leitura obrigatória antes
de depender deste pacote em produção — em especial que o comportamento entre
navegadores, o tratamento real de cota e a execução dentro de um Worker de
verdade continuam todos sem teste.
