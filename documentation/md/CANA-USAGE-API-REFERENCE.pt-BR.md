# Referência de API

Mapa compacto da superfície pública do Cana usada pelo guia.

## Ciclo de vida do client

| API | Propósito |
| --- | --- |
| `createClient(options)` | Criar um client de banco no navegador. |
| `client.open()` | Abrir ou atualizar o banco. |
| `client.close()` | Fechar a conexão aberta. |
| `client.backend` | Ler `indexeddb` ou `localStorage` depois de `open()`. |
| `client.storageState()` | Inspecionar disponibilidade de storage e sinal de cota. |
| `client.durabilityAssessment()` | Inspecionar confiança de persistência. |

## Tabelas

| API | Propósito |
| --- | --- |
| `client.table<TRecord>(name)` | Criar um handle tipado de tabela. |
| `table.get(key)` | Ler um registro por chave primária. |
| `table.add(record, key)` | Inserir somente quando a chave está livre. |
| `table.put(record, key)` | Inserir ou substituir. |
| `table.update(key, changes)` | Mesclar campos em um registro existente. |
| `table.delete(key)` | Apagar um registro. |
| `table.clear()` | Apagar todos os registros da store. |
| `table.bulkAdd(records)` | Inserir lote em uma transação. |
| `table.bulkPut(records)` | Fazer upsert de lote em uma transação. |
| `table.bulkDelete(keys)` | Apagar lote em uma transação. |
| `table.query(query)` | Ler registros com índice, direção, offset e limit opcionais. |
| `table.count(query)` | Contar registros sem materializá-los em JavaScript. |
| `table.explain(query)` | Retornar registros mais o plano de query usado pelo Cana. |

## Transações e eventos

| API | Propósito |
| --- | --- |
| `client.transaction(mode, stores, body)` | Executar uma fronteira de commit multi-store. |
| `client.subscribe(listener)` | Ouvir entradas `CanaChangeEvent` commitadas. |
| `client.subscribe(listener, { sinceCursor })` | Reexecutar eventos retidos mais novos que o cursor. |
| `client.resolveWrite(correlationId, attemptedAt)` | Resolver escrita com outcome incerto quando `operationLedger` está ligado. |

## APIs de worker

| API | Propósito |
| --- | --- |
| `createWorkerHost(options)` | Servir um client Cana real atrás de Worker ou MessagePort. |
| `createRouter(options)` | Correlacionar requisições e respostas no lado da página. |
| `createWorkerClient(router)` | Facade tipada para operações request/response através da fronteira. |

## Factory adapter

Use o factory adapter quando o restante de uma aplicação Jumentix espera handles
de store parecidos com repositórios em vez de chamar `client.table()` direto.

<CanaPlayground id="factory-adapter" />

## Glossário

| Termo | Significado |
| --- | --- |
| Backend | Implementação real de storage: IndexedDB ou fallback localStorage. |
| Cursor | Número monotônico anexado a eventos de mudança commitados. |
| Fonte durável da verdade | Camada de dados que sobrevive a reloads. O Cana ocupa esse papel para dados offline no navegador. |
| Replay de eventos | Entrega de eventos retidos depois que um subscriber reconecta com `sinceCursor`. |
| Operation ledger | Store opcional que permite ao Cana resolver outcome incerto de escrita. |
| Plano de query | Descrição de uso de índice, key range, count request ou scan. |
| Structured clone | Serialização do navegador usada por mensagens de Worker; rejeita funções e instâncias de classe com estado privado. |
