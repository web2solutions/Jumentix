export type CanaSnippet = {
  id: string;
  title: { en: string; 'pt-BR': string };
  description: { en: string; 'pt-BR': string };
  code: string;
};

const schemaSource = `{
  version: 1,
  stores: [
    { name: 'categorias', keyPath: 'id', indexes: [{ name: 'porNome', keyPath: 'nome', unique: true }] },
    {
      name: 'tarefas',
      keyPath: 'id',
      indexes: [
        { name: 'porCategoria', keyPath: 'categoriaId' },
        { name: 'porConcluida', keyPath: 'concluida' },
        { name: 'porAtualizadaEm', keyPath: 'atualizadaEm' }
      ]
    }
  ]
}`;

const seedSource = `const agora = Date.now();
await client.table('categorias').bulkAdd([
  { id: 'trabalho', nome: 'Trabalho', cor: '#2563eb', criadaEm: agora, atualizadaEm: agora },
  { id: 'casa', nome: 'Casa', cor: '#16a34a', criadaEm: agora, atualizadaEm: agora }
]);
await client.table('tarefas').bulkAdd([
  {
    id: 'tarefa-1',
    titulo: 'Escrever tutorial do Cana',
    categoriaId: 'trabalho',
    concluida: false,
    prioridade: 'alta',
    criadaEm: agora,
    atualizadaEm: agora
  },
  {
    id: 'tarefa-2',
    titulo: 'Revisar filtros por categoria',
    categoriaId: 'casa',
    concluida: true,
    prioridade: 'media',
    criadaEm: agora,
    atualizadaEm: agora + 1
  }
]);`;

/**
 * Public-feature playground catalog. Snippets are modern JS (no TypeScript
 * syntax) so the browser can run them after a light wrap — `cana` is injected.
 */
export const CANA_SNIPPETS: readonly CanaSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Getting started', 'pt-BR': 'Primeiros passos' },
    description: {
      en: 'Open a client, create Categoria and Tarefa records, then read them back.',
      'pt-BR': 'Abra um client, crie registros Categoria e Tarefa, depois leia de volta.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categorias').add({
  id: 'trabalho',
  nome: 'Trabalho',
  cor: '#2563eb',
  criadaEm: Date.now(),
  atualizadaEm: Date.now()
});
await client.table('tarefas').add({
  id: 'tarefa-1',
  titulo: 'Escrever tutorial do Cana',
  categoriaId: 'trabalho',
  concluida: false,
  prioridade: 'alta',
  criadaEm: Date.now(),
  atualizadaEm: Date.now()
});
return {
  backend: client.backend,
  categoria: await client.table('categorias').get('trabalho'),
  tarefa: await client.table('tarefas').get('tarefa-1')
};`
  },
  {
    id: 'schema-versioning',
    title: { en: 'Schema upgrade', 'pt-BR': 'Upgrade de schema' },
    description: {
      en: 'Start with Categoria, then raise the version and add the Tarefa table.',
      'pt-BR': 'Comece com Categoria, depois suba a versao e adicione a tabela Tarefa.'
    },
    code: `const v1 = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [{ name: 'categorias', keyPath: 'id' }]
  }
});
await v1.open();
await v1.table('categorias').add({ id: 'trabalho', nome: 'Trabalho' });
await v1.close();

const v2 = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await v2.open();
await v2.table('tarefas').add({
  id: 'tarefa-1',
  titulo: 'Criada apos upgrade',
  categoriaId: 'trabalho',
  concluida: false,
  prioridade: 'media',
  criadaEm: Date.now(),
  atualizadaEm: Date.now()
});
return {
  categorias: await v2.table('categorias').query(),
  tarefas: await v2.table('tarefas').query()
};`
  },
  {
    id: 'keys',
    title: { en: 'Keys', 'pt-BR': 'Chaves' },
    description: {
      en: 'Use stable ids in Categoria and Tarefa records.',
      'pt-BR': 'Use ids estaveis nos registros Categoria e Tarefa.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categorias').add({
  id: 'docs',
  nome: 'Docs',
  cor: '#0f766e',
  criadaEm: 1,
  atualizadaEm: 1
});
await client.table('tarefas').add({
  id: 'docs-1',
  titulo: 'Documentar chaves estaveis',
  categoriaId: 'docs',
  concluida: false,
  prioridade: 'media',
  criadaEm: 2,
  atualizadaEm: 2
});
return {
  categoriaKey: 'docs',
  tarefaKey: 'docs-1',
  tarefa: await client.table('tarefas').get('docs-1')
};`
  },
  {
    id: 'crud',
    title: { en: 'CRUD', 'pt-BR': 'CRUD' },
    description: {
      en: 'Create, read, update and delete one Tarefa.',
      'pt-BR': 'Crie, leia, atualize e remova uma Tarefa.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categorias').add({ id: 'trabalho', nome: 'Trabalho', cor: '#2563eb' });
const tarefas = client.table('tarefas');
await tarefas.add({
  id: 'tarefa-1',
  titulo: 'Rascunhar tutorial',
  categoriaId: 'trabalho',
  concluida: false,
  prioridade: 'alta',
  criadaEm: 1,
  atualizadaEm: 1
});
await tarefas.update('tarefa-1', { concluida: true, atualizadaEm: 2 });
const depoisDoUpdate = await tarefas.get('tarefa-1');
await tarefas.delete('tarefa-1');
return { depoisDoUpdate, depoisDoDelete: await tarefas.get('tarefa-1') };`
  },
  {
    id: 'bulk',
    title: { en: 'Bulk operations', 'pt-BR': 'Operacoes em lote' },
    description: {
      en: 'Seed Categoria and Tarefa records with bulk operations.',
      'pt-BR': 'Popule Categoria e Tarefa com operacoes em lote.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const put = await client.table('tarefas').bulkPut([
  {
    id: 'tarefa-2',
    titulo: 'Revisar filtros por categoria',
    categoriaId: 'casa',
    concluida: false,
    prioridade: 'alta',
    criadaEm: Date.now(),
    atualizadaEm: Date.now()
  },
  {
    id: 'tarefa-3',
    titulo: 'Publicar app de exemplo',
    categoriaId: 'trabalho',
    concluida: false,
    prioridade: 'media',
    criadaEm: Date.now(),
    atualizadaEm: Date.now()
  }
]);
return {
  put,
  categorias: await client.table('categorias').query({ index: 'porNome' }),
  tarefas: await client.table('tarefas').query({ index: 'porAtualizadaEm' })
};`
  },
  {
    id: 'query-explain',
    title: { en: 'Query + explain', 'pt-BR': 'Query + explain' },
    description: {
      en: 'Run an indexed Tarefa query by Categoria and inspect the plan.',
      'pt-BR': 'Rode uma query indexada de Tarefa por Categoria e inspecione o plano.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const { records, plan } = await client.table('tarefas').explain({
  index: 'porCategoria',
  equals: 'trabalho'
});
return { records, plan };`
  },
  {
    id: 'transactions',
    title: { en: 'Transactions', 'pt-BR': 'Transacoes' },
    description: {
      en: 'Create one Categoria and its first Tarefa in a single commit.',
      'pt-BR': 'Crie uma Categoria e sua primeira Tarefa em um unico commit.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
const tx = await client.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
  const agora = Date.now();
  await scope.table('categorias').put({
    id: 'ops',
    nome: 'Operacoes',
    cor: '#f97316',
    criadaEm: agora,
    atualizadaEm: agora
  });
  await scope.table('tarefas').put({
    id: 'ops-1',
    titulo: 'Criada junto com a categoria',
    categoriaId: 'ops',
    concluida: false,
    prioridade: 'alta',
    criadaEm: agora,
    atualizadaEm: agora
  });
  return 'ok';
});
return {
  outcome: tx.outcome,
  result: tx.result,
  categorias: await client.table('categorias').query(),
  tarefas: await client.table('tarefas').query()
};`
  },
  {
    id: 'change-events',
    title: { en: 'Change events', 'pt-BR': 'Eventos de mudanca' },
    description: {
      en: 'Subscribe and collect committed Tarefa events.',
      'pt-BR': 'Assine e colete eventos confirmados de Tarefa.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
const seen = [];
const stop = client.subscribe((event) => {
  seen.push({ cursor: event.cursor, type: event.type, store: event.store, key: event.key });
});
await client.table('categorias').add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
await client.table('tarefas').add({
  id: 'docs-1',
  titulo: 'Ouvir eventos do Cana',
  categoriaId: 'docs',
  concluida: false,
  prioridade: 'media',
  criadaEm: 1,
  atualizadaEm: 1
});
await client.table('tarefas').update('docs-1', { concluida: true, atualizadaEm: 2 });
stop();
return { events: seen };`
  },
  {
    id: 'hooks',
    title: { en: 'Hooks', 'pt-BR': 'Hooks' },
    description: {
      en: 'Run beforeWrite and afterCommit hooks around Tarefa writes.',
      'pt-BR': 'Rode hooks beforeWrite e afterCommit ao redor de escritas de Tarefa.'
    },
    code: `const trail = [];
const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  hooks: {
    beforeWrite: (ctx) => { trail.push('before:' + ctx.store + ':' + ctx.type); },
    afterCommit: (events) => { trail.push('commit:' + events.length); }
  }
});
await client.open();
await client.table('categorias').add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
await client.table('tarefas').add({
  id: 'docs-1',
  titulo: 'Passa pelos hooks',
  categoriaId: 'docs',
  concluida: false,
  prioridade: 'media',
  criadaEm: 1,
  atualizadaEm: 1
});
return { trail, tarefa: await client.table('tarefas').get('docs-1') };`
  },
  {
    id: 'errors',
    title: { en: 'Errors', 'pt-BR': 'Erros' },
    description: {
      en: 'Detect duplicate Categoria ids with isCanaErrorCode.',
      'pt-BR': 'Detecte ids duplicados de Categoria com isCanaErrorCode.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categorias').add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
try {
  await client.table('categorias').add({ id: 'docs', nome: 'Duplicada', cor: '#dc2626' });
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
    title: { en: 'Storage assessment', 'pt-BR': 'Avaliacao de storage' },
    description: {
      en: 'Read storageState and durabilityAssessment after writing Tarefa data.',
      'pt-BR': 'Leia storageState e durabilityAssessment depois de gravar Tarefa.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categorias').add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
await client.table('tarefas').add({
  id: 'docs-1',
  titulo: 'Dados que precisam sobreviver',
  categoriaId: 'docs',
  concluida: false,
  prioridade: 'alta',
  criadaEm: 1,
  atualizadaEm: 1
});
const storage = await client.storageState();
const durability = await client.durabilityAssessment();
return { backend: client.backend, storage, durability };`
  },
  {
    id: 'crash-recovery',
    title: { en: 'Operation ledger', 'pt-BR': 'Operation ledger' },
    description: {
      en: 'Resolve a committed Tarefa write with the operation ledger enabled.',
      'pt-BR': 'Resolva uma escrita de Tarefa commitada com operation ledger ligado.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  operationLedger: true
});
await client.open();
const tx = await client.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
  const agora = Date.now();
  await scope.table('categorias').put({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
  await scope.table('tarefas').put({
    id: 'docs-1',
    titulo: 'Reconcilia escrita incerta',
    categoriaId: 'docs',
    concluida: false,
    prioridade: 'alta',
    criadaEm: agora,
    atualizadaEm: agora
  });
  return 'wrote';
});
const resolved = await client.resolveWrite(tx.correlationId, tx.attemptedAt);
return { outcome: tx.outcome, resolved, tarefa: await client.table('tarefas').get('docs-1') };`
  },
  {
    id: 'export-import',
    title: { en: 'Export', 'pt-BR': 'Export' },
    description: {
      en: 'Export Categoria and Tarefa stores as plain data.',
      'pt-BR': 'Exporte as stores Categoria e Tarefa como dados puros.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const dump = await client.exportAll();
return dump;`
  },
  {
    id: 'fallback-backend',
    title: { en: 'Backend selection', 'pt-BR': 'Selecao de backend' },
    description: {
      en: 'Show client.backend after opening the task database.',
      'pt-BR': 'Mostre client.backend apos abrir o banco de tarefas.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  fallback: 'localStorage'
});
await client.open();
await client.table('categorias').add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
return { backend: client.backend, categorias: await client.table('categorias').query() };`
  },
  {
    id: 'factory-adapter',
    title: { en: 'Factory adapter', 'pt-BR': 'Adapter de factory' },
    description: {
      en: 'Use createCanaDatabaseClient with Categoria and Tarefa stores.',
      'pt-BR': 'Use createCanaDatabaseClient com stores Categoria e Tarefa.'
    },
    code: `const adapter = cana.createCanaDatabaseClient({
  name: dbName,
  schema: ${schemaSource}
});
await adapter.connect();
await adapter.stores.categorias.add({ id: 'docs', nome: 'Docs', cor: '#0f766e' });
await adapter.stores.tarefas.add({
  id: 'docs-1',
  titulo: 'Criada via adapter',
  categoriaId: 'docs',
  concluida: false,
  prioridade: 'media',
  criadaEm: 1,
  atualizadaEm: 1
});
const tarefa = await adapter.stores.tarefas.get('docs-1');
await adapter.disconnect();
return {
  backend: adapter.cana.backend,
  stores: Object.keys(adapter.stores),
  tarefa
};`
  }
];

export function getCanaSnippet(id: string): CanaSnippet | undefined {
  return CANA_SNIPPETS.find((snippet) => snippet.id === id);
}
