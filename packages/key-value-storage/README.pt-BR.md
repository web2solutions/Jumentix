<!--
Arquivo gerado automaticamente a partir de: packages/key-value-storage/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/key-value-storage

Adaptadores reutilizáveis de armazenamento chave-valor para serviços Jumentix.

Incluído:

- Contratos `IKeyValueStorageClient`
- `InMemoryKeyValueStorageClient`
- `RedisKeyValueStorageClient`
- seletor orientado ao ambiente `compileKeyValueStorageClient`

Este pacote foi projetado para reutilização de vários serviços e evita a duplicação de adaptadores por serviço.

## Responsabilidade no escopo

- **Camada:** persistência / infraestrutura
- **Responsável por:** porta chave/valor + adapters InMemory/Redis
- **Usado com:** mutex-service, composição de backend
- **Não responsável por:** repos SQL/documentos, IndexedDB (Cana), SDKs HTTP

## Experimente no navegador

Adapter in-memory (mock no browser do mesmo contrato):

<DocsPlayground runtime="key-value-storage" id="getting-started" />

## Documentação completa

Veja o [guia de uso](../../documentation/md/KEY-VALUE-STORAGE-USAGE-GUIDE.pt-BR.md).
