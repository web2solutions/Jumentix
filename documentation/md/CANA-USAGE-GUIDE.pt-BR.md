# Cana — Guia de uso

Hub focado para `@jumentix/cana`.

O Cana é a camada de persistência no navegador para aplicações Jumentix. Use
quando o frontend precisa de dados offline duráveis, transações IndexedDB
explícitas, eventos de mudança, isolamento por worker e uma ponte clara para
React Context, Redux, Pinia ou outra store de UI.

Esta página é intencionalmente curta. O guia completo foi dividido em páginas
menores para cada assunto mostrar código completo sem virar uma parede única.

## Escolha o próximo passo

1. [Primeiros passos](./CANA-USAGE-GETTING-STARTED.pt-BR.md) — instale o Cana, crie as tabelas
   `categories` e `tasks`, grave dados iniciais e leia tudo de volta.
2. [Schema e chaves](./CANA-USAGE-SCHEMA-KEYS.pt-BR.md) — mudanças versionadas de schema, chaves
   inbound, chaves geradas, chaves outbound e validação.
3. [Leitura, escrita e operações em lote](./CANA-USAGE-CRUD-BULK.pt-BR.md) — `get`, `add`, `put`,
   `update`, `delete`, `clear`, `bulkAdd`, `bulkPut` e tratamento previsível de
   falhas.
4. [Queries e planos](./CANA-USAGE-QUERYING.pt-BR.md) — índices, `equals`, `limit`, `offset`,
   `count`, `explain()` e complexidade.
5. [Transações e eventos de mudança](./CANA-USAGE-TRANSACTIONS-EVENTS.pt-BR.md) — escritas
   atômicas, `CanaChangeEvent`, janelas de replay e sincronização com stores de
   UI.
6. [Hooks e erros](./CANA-USAGE-HOOKS-ERRORS.pt-BR.md) — `beforeWrite`, `afterCommit`, guards de
   `CanaError` e ramos comuns de recuperação.
7. [Storage e recuperação de crash](./CANA-USAGE-STORAGE-RECOVERY.pt-BR.md) — avaliação de storage,
   avaliação de durabilidade, export/import e `resolveWrite()`.
8. [Workers e testes](./CANA-USAGE-WORKERS-TESTING.pt-BR.md) — `createWorkerHost()`,
   `createRouter()`, `createWorkerClient()` e estratégia de testes.
9. [Referência de API](./CANA-USAGE-API-REFERENCE.pt-BR.md) — mapa compacto de métodos e glossário.

## O exemplo contínuo

Todas as páginas usam o mesmo sistema simples de tarefas. Existem duas stores:

| Store | Propósito | Campos principais |
| --- | --- | --- |
| `categories` | Agrupa tarefas por área. | `id`, `name`, `color`, `createdAt`, `updatedAt` |
| `tasks` | Registros duráveis de tarefas. | `id`, `title`, `categoryId`, `completed`, `priority`, `createdAt`, `updatedAt` |

Os exemplos mantêm o estado de framework fora do Cana. O Cana controla
persistência e eventos commitados; React Context, Redux e Pinia controlam o
estado renderizado.

## Política de código completo

Os blocos de código destas páginas são escritos como unidades de implementação
copiáveis. Quando um snippet pode executar no site, a página inclui um
playground com Run. Quando um snippet precisa de uma fronteira real de
aplicação, como um arquivo dedicado de Worker, a página mostra todos os arquivos
envolvidos em vez de esconder partes faltantes atrás de placeholders.

## Tutoriais por framework

Construa o mesmo app de tarefas categorizadas com state management:

- [Cana com React Context API](/docs/pt-BR/jumentix/packages/cana/react-context)
- [Cana com React Redux](/docs/pt-BR/jumentix/packages/cana/react-redux)
- [Cana com Vue 3 e Pinia](/docs/pt-BR/jumentix/packages/cana/vue-pinia)

## Integrações de pacote

Use os pequenos pacotes de integração quando quiser que eventos do Cana
atualizem o estado do framework diretamente:

```bash
bun add @jumentix/cana @jumentix/cana-react
bun add @jumentix/cana @jumentix/cana-vue
```
