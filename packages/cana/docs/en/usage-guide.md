# Cana — Usage Guide

Focused guide hub for `@jumentix/cana`.

Cana is a framework-agnostic IndexedDB client for any browser frontend. Use it
when an application needs durable offline data, explicit IndexedDB transactions,
change events, optional worker isolation, and a clear bridge to whatever UI store
you already use (vanilla state, React Context, Redux, Pinia, or another library).

It was built for Jumentix, but the public API has no framework dependency — only
the browser.

This page is intentionally short. The full guide is split into smaller pages so
each topic can show complete code without turning one document into a wall.

## Choose the next step

1. [Getting started](./getting-started.md) — install Cana, create the `categories`
   and `tasks` tables, seed data, and read it back.
2. [Integrate with any framework](./any-framework.md) — the wiring pattern for any UI store.
3. [Vanilla TypeScript](./vanilla-typescript.md) — same task app without a framework.
4. [Schema and keys](./schema-keys.md) — versioned schema changes, inbound keys,
   generated keys, outbound keys and validation.
5. [Reading, writing and bulk operations](./crud-bulk.md) — `get`, `add`, `put`,
   `update`, `delete`, `clear`, `bulkAdd`, `bulkPut` and predictable failure
   handling.
6. [Querying and plans](./querying.md) — indexes, `equals`, `limit`, `offset`,
   `count`, `explain()` and complexity.
7. [Transactions and change events](./transactions-events.md) — atomic writes,
   `CanaChangeEvent`, replay windows and UI store synchronization.
8. [Hooks and errors](./hooks-errors.md) — `beforeWrite`, `afterCommit`,
   `CanaError` guards and common recovery branches.
9. [Storage and crash recovery](./storage-recovery.md) — storage assessment,
   durability assessment, export/import and `resolveWrite()`.
10. [Workers and testing](./workers-testing.md) — `createWorkerHost()`,
    `createRouter()`, `createWorkerClient()` and test strategy.
11. [API reference](./api-reference.md) — compact method map and glossary.

## The running example

Every page uses the same small task system. There are two stores:

| Store        | Purpose                    | Main fields                                                                    |
| ------------ | -------------------------- | ------------------------------------------------------------------------------ |
| `categories` | Groups tasks by work area. | `id`, `name`, `color`, `createdAt`, `updatedAt`                                |
| `tasks`      | Durable task records.      | `id`, `title`, `categoryId`, `completed`, `priority`, `createdAt`, `updatedAt` |

The examples keep framework state outside Cana. Cana owns persistence and
committed events; your UI store (vanilla `Map`, Context, Redux, Pinia, …)
owns rendering state.

## Complete code policy

The code blocks in these pages are written as copyable implementation units.
When a snippet is executable in the website, the page includes a Run playground.
When a snippet needs a real application boundary, such as a dedicated Worker
file, the page shows every file involved instead of hiding the missing parts
behind placeholders.

## Use with any UI framework

1. [Integrate with any framework](./any-framework.md) — the stable contract and five-step wiring pattern.
2. [Vanilla TypeScript tutorial](./vanilla-typescript.md) — no framework helpers, DOM/`Map` state.
3. [React Context API](/docs/jumentix/packages/cana/react-context)
4. [React Redux](/docs/jumentix/packages/cana/react-redux)
5. [Vue 3 and Pinia](/docs/jumentix/packages/cana/vue-pinia)

Optional helpers (`@jumentix/cana-react`, `@jumentix/cana-vue`) only patch framework state for you; they are not required.

## Package integrations

Use the small integration packages when you want Cana events to patch framework
state directly:

```bash
bun add @jumentix/cana @jumentix/cana-react
bun add @jumentix/cana @jumentix/cana-vue
```
