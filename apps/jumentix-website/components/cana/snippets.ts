export type CanaSnippet = {
  id: string;
  title: { en: string; 'pt-BR': string };
  description: { en: string; 'pt-BR': string };
  code: string;
};

/**
 * Public-feature playground catalog. Snippets are modern JS (no TypeScript
 * syntax) so the browser can run them after a light wrap — `cana` is injected.
 */
export const CANA_SNIPPETS: readonly CanaSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Getting started', 'pt-BR': 'Primeiros passos' },
    description: {
      en: 'Open a client, write one record, read backend kind.',
      'pt-BR': 'Abra um client, grave um registro, leia o backend.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [{ name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }]
  }
});
await client.open();
await client.table('designs').add({ id: 1, name: 'first', owner: 'ana' });
const row = await client.table('designs').get(1);
return { backend: client.backend, row };`
  },
  {
    id: 'schema-versioning',
    title: { en: 'Schema upgrade', 'pt-BR': 'Upgrade de schema' },
    description: {
      en: 'Additive store upgrade by raising version.',
      'pt-BR': 'Upgrade aditivo de store aumentando a version.'
    },
    code: `const v1 = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'notes', keyPath: 'id' }] }
});
await v1.open();
await v1.table('notes').add({ id: 'a', text: 'hello' });
await v1.close();

const v2 = cana.createClient({
  name: dbName,
  schema: {
    version: 2,
    stores: [
      { name: 'notes', keyPath: 'id' },
      { name: 'tags', keyPath: 'id', indexes: [{ name: 'byName', keyPath: 'name' }] }
    ]
  }
});
await v2.open();
await v2.table('tags').add({ id: 't1', name: 'work' });
return {
  notes: await v2.table('notes').query(),
  tags: await v2.table('tags').query()
};`
  },
  {
    id: 'keys',
    title: { en: 'Keys', 'pt-BR': 'Chaves' },
    description: {
      en: 'Inline keyPath vs out-of-line key on add.',
      'pt-BR': 'keyPath inline vs chave out-of-line no add.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [
      { name: 'inline', keyPath: 'id' },
      { name: 'outline' }
    ]
  }
});
await client.open();
await client.table('inline').add({ id: 'i1', value: 1 });
await client.table('outline').add({ value: 2 }, 'o1');
return {
  inline: await client.table('inline').get('i1'),
  outline: await client.table('outline').get('o1')
};`
  },
  {
    id: 'crud',
    title: { en: 'CRUD', 'pt-BR': 'CRUD' },
    description: {
      en: 'add, get, put, update, delete.',
      'pt-BR': 'add, get, put, update, delete.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
const t = client.table('items');
await t.add({ id: 1, name: 'a' });
await t.put({ id: 1, name: 'b' });
await t.update(1, { name: 'c' });
const mid = await t.get(1);
await t.delete(1);
return { mid, afterDelete: await t.get(1) };`
  },
  {
    id: 'bulk',
    title: { en: 'Bulk operations', 'pt-BR': 'Operações em lote' },
    description: {
      en: 'bulkAdd and bulkPut results.',
      'pt-BR': 'resultados de bulkAdd e bulkPut.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
const t = client.table('items');
const added = await t.bulkAdd([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' }
]);
const put = await t.bulkPut([
  { id: 2, name: 'b2' },
  { id: 3, name: 'c' }
]);
return { added, put, all: await t.query() };`
  },
  {
    id: 'query-explain',
    title: { en: 'Query + explain', 'pt-BR': 'Query + explain' },
    description: {
      en: 'Indexed query and plan from explain().',
      'pt-BR': 'Query indexada e plano via explain().'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [{
      name: 'designs',
      keyPath: 'id',
      indexes: [{ name: 'byOwner', keyPath: 'owner' }]
    }]
  }
});
await client.open();
const t = client.table('designs');
await t.bulkAdd([
  { id: 1, owner: 'ana', name: 'one' },
  { id: 2, owner: 'bob', name: 'two' },
  { id: 3, owner: 'ana', name: 'three' }
]);
const { records, plan } = await t.explain({
  index: 'byOwner',
  equals: 'ana'
});
return { records, plan };`
  },
  {
    id: 'transactions',
    title: { en: 'Transactions', 'pt-BR': 'Transações' },
    description: {
      en: 'Multi-store transaction commit.',
      'pt-BR': 'Commit de transação multi-store.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [
      { name: 'accounts', keyPath: 'id' },
      { name: 'ledger', keyPath: 'id' }
    ]
  }
});
await client.open();
await client.table('accounts').add({ id: 'a', balance: 100 });
const tx = await client.transaction('readwrite', ['accounts', 'ledger'], async (scope) => {
  const account = await scope.table('accounts').get('a');
  await scope.table('accounts').put({ id: 'a', balance: account.balance - 10 });
  await scope.table('ledger').add({ id: 'l1', delta: -10 });
  return 'ok';
});
return {
  outcome: tx.outcome,
  result: tx.result,
  account: await client.table('accounts').get('a'),
  ledger: await client.table('ledger').query()
};`
  },
  {
    id: 'change-events',
    title: { en: 'Change events', 'pt-BR': 'Eventos de mudança' },
    description: {
      en: 'Subscribe and collect write events.',
      'pt-BR': 'Subscribe e colete eventos de escrita.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
const seen = [];
const stop = client.subscribe((event) => {
  seen.push({ type: event.type, store: event.store, key: event.key });
});
await client.table('items').add({ id: 1, name: 'x' });
await client.table('items').put({ id: 1, name: 'y' });
stop();
return { events: seen };`
  },
  {
    id: 'hooks',
    title: { en: 'Hooks', 'pt-BR': 'Hooks' },
    description: {
      en: 'beforeWrite and afterCommit hooks.',
      'pt-BR': 'hooks beforeWrite e afterCommit.'
    },
    code: `const trail = [];
const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] },
  hooks: {
    beforeWrite: (ctx) => { trail.push('before:' + ctx.type); },
    afterCommit: (events) => { trail.push('commit:' + events.length); }
  }
});
await client.open();
await client.table('items').add({ id: 1, name: 'hooked' });
return { trail, row: await client.table('items').get(1) };`
  },
  {
    id: 'errors',
    title: { en: 'Errors', 'pt-BR': 'Erros' },
    description: {
      en: 'Detect ConstraintViolation with isCanaErrorCode.',
      'pt-BR': 'Detecte ConstraintViolation com isCanaErrorCode.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
await client.table('items').add({ id: 1, name: 'once' });
try {
  await client.table('items').add({ id: 1, name: 'twice' });
  return { unexpected: 'no error' };
} catch (error) {
  return {
    isCanaError: cana.isCanaError(error),
    constraint: cana.isCanaErrorCode(error, 'ConstraintViolation'),
    code: error && error.code
  };
}`
  },
  {
    id: 'storage-durability',
    title: { en: 'Storage assessment', 'pt-BR': 'Avaliação de storage' },
    description: {
      en: 'Read storageState and durabilityAssessment.',
      'pt-BR': 'Leia storageState e durabilityAssessment.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
await client.table('items').add({ id: 1, name: 'kept' });
const storage = await client.storageState();
const durability = await client.durabilityAssessment();
return { backend: client.backend, storage, durability };`
  },
  {
    id: 'crash-recovery',
    title: { en: 'Operation ledger', 'pt-BR': 'Operation ledger' },
    description: {
      en: 'resolveWrite after a committed write with ledger on.',
      'pt-BR': 'resolveWrite após escrita com ledger ligado.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] },
  operationLedger: true
});
await client.open();
const tx = await client.transaction('readwrite', ['items'], async (scope) => {
  await scope.table('items').add({ id: 1, name: 'ledger' });
  return 'wrote';
});
const resolved = await client.resolveWrite(tx.correlationId, tx.attemptedAt);
return { outcome: tx.outcome, resolved, row: await client.table('items').get(1) };`
  },
  {
    id: 'export-import',
    title: { en: 'Export', 'pt-BR': 'Export' },
    description: {
      en: 'exportAll snapshot of stores.',
      'pt-BR': 'snapshot exportAll das stores.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await client.open();
await client.table('items').bulkAdd([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' }
]);
const dump = await client.exportAll();
return dump;`
  },
  {
    id: 'fallback-backend',
    title: { en: 'Backend selection', 'pt-BR': 'Seleção de backend' },
    description: {
      en: 'Show client.backend after open (IndexedDB when available).',
      'pt-BR': 'Mostre client.backend após open (IndexedDB quando disponível).'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] },
  fallback: 'localStorage'
});
await client.open();
await client.table('items').add({ id: 1, name: 'stored' });
return { backend: client.backend, row: await client.table('items').get(1) };`
  },
  {
    id: 'factory-adapter',
    title: { en: 'Factory adapter', 'pt-BR': 'Adapter de factory' },
    description: {
      en: 'createCanaDatabaseClient bridge surface.',
      'pt-BR': 'superficie createCanaDatabaseClient.'
    },
    code: `const adapter = cana.createCanaDatabaseClient({
  name: dbName,
  schema: { version: 1, stores: [{ name: 'items', keyPath: 'id' }] }
});
await adapter.connect();
await adapter.stores.items.add({ id: 1, name: 'via-adapter' });
const row = await adapter.stores.items.get(1);
await adapter.disconnect();
return {
  backend: adapter.cana.backend,
  stores: Object.keys(adapter.stores),
  row
};`
  }
];

export function getCanaSnippet(id: string): CanaSnippet | undefined {
  return CANA_SNIPPETS.find((snippet) => snippet.id === id);
}
