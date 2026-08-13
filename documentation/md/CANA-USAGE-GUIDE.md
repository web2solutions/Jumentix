# Cana — Usage Guide

Focused guide hub for `@jumentix/cana`.

Cana is the browser persistence layer for Jumentix applications. Use it when a
frontend needs durable offline data, explicit IndexedDB transactions, change
events, worker isolation, and a clear bridge to React Context, Redux, Pinia or
another UI store.

This page is intentionally short. The full guide is split into smaller pages so
each topic can show complete code without turning one document into a wall.

## Choose the next step

1. [Getting started](./CANA-USAGE-GETTING-STARTED.md) — install Cana, create the `categories`
   and `tasks` tables, seed data, and read it back.
2. [Schema and keys](./CANA-USAGE-SCHEMA-KEYS.md) — versioned schema changes, inbound keys,
   generated keys, outbound keys and validation.
3. [Reading, writing and bulk operations](./CANA-USAGE-CRUD-BULK.md) — `get`, `add`, `put`,
   `update`, `delete`, `clear`, `bulkAdd`, `bulkPut` and predictable failure
   handling.
4. [Querying and plans](./CANA-USAGE-QUERYING.md) — indexes, `equals`, `limit`, `offset`,
   `count`, `explain()` and complexity.
5. [Transactions and change events](./CANA-USAGE-TRANSACTIONS-EVENTS.md) — atomic writes,
   `CanaChangeEvent`, replay windows and UI store synchronization.
6. [Hooks and errors](./CANA-USAGE-HOOKS-ERRORS.md) — `beforeWrite`, `afterCommit`,
   `CanaError` guards and common recovery branches.
7. [Storage and crash recovery](./CANA-USAGE-STORAGE-RECOVERY.md) — backend selection,
   durability assessment, export/import and `resolveWrite()`.
8. [Workers and testing](./CANA-USAGE-WORKERS-TESTING.md) — `createWorkerHost()`,
   `createRouter()`, `createWorkerClient()` and test strategy.
9. [API reference](./CANA-USAGE-API-REFERENCE.md) — compact method map and glossary.

## The running example

Every page uses the same small task system. There are two stores:

| Store | Purpose | Main fields |
| --- | --- | --- |
| `categories` | Groups tasks by work area. | `id`, `name`, `color`, `createdAt`, `updatedAt` |
| `tasks` | Durable task records. | `id`, `title`, `categoryId`, `completed`, `priority`, `createdAt`, `updatedAt` |

The examples keep framework state outside Cana. Cana owns persistence and
committed events; React Context, Redux and Pinia own rendering state.

## Complete code policy

The code blocks in these pages are written as copyable implementation units.
When a snippet is executable in the website, the page includes a Run playground.
When a snippet needs a real application boundary, such as a dedicated Worker
file, the page shows every file involved instead of hiding the missing parts
behind placeholders.

## Framework tutorials

Build the same categorized task app with state management:

- [Cana with React Context API](/docs/jumentix/packages/cana/react-context)
- [Cana with React Redux](/docs/jumentix/packages/cana/react-redux)
- [Cana with Vue 3 and Pinia](/docs/jumentix/packages/cana/vue-pinia)

## Package integrations

Use the small integration packages when you want Cana events to patch framework
state directly:

```bash
bun add @jumentix/cana @jumentix/cana-react
bun add @jumentix/cana @jumentix/cana-vue
```
