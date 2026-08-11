# @jumentix/mutex-service

Adapter privado e reutilizável de mutex para runtimes Jumentix.

## Responsabilidade no escopo

- **Camada:** persistência / coordenação
- **Responsável por:** locks nomeados sobre um cliente KV
- **Usado com:** key-value-storage
- **Não responsável por:** documentos de negócio ou messaging

## Contrato

`MutexService.compile(keyValueStorageClient, options)` cria um singleton por processo apoiado em um
`IKeyValueStorageClient`. O cliente deve implementar `get`, `set`, `del`, `connect` e `disconnect`
assíncronos, retornando `IServiceResponse`.

- `lock(resourceName, uuid)` retorna `{ previouslyLocked, locked }` em `result`.
- `isLocked(resourceName, uuid)` retorna um booleano em `result`.
- `unlock(resourceName, uuid)` repassa o resultado da remoção no storage.
- Falhas são retornadas em `error`; elas não são lançadas ao chamador.
- `reset()` limpa o singleton, principalmente para testes isolados e recomposição.

O prefixo padrão da chave é `mutex`; um `prefix` customizado pode ser fornecido na compilação.

## Validação

```bash
bun run --filter @jumentix/mutex-service build
bun run --filter @jumentix/mutex-service typecheck
bun run --filter @jumentix/mutex-service lint
bun run --filter @jumentix/mutex-service test
```

## Experimente no navegador

<DocsPlayground runtime="mutex-service" id="getting-started" />

## Documentação completa

Veja o [guia de uso](../../documentation/md/MUTEX-SERVICE-USAGE-GUIDE.pt-BR.md).
