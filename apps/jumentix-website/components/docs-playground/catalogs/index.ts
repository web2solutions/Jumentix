import type { DocsRuntimeId, DocsSnippet } from '../types';
import { CANA_SNIPPETS } from '../../cana/snippets';

export const DESIGNER_CORE_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Validate a design', 'pt-BR': 'Validar um design' },
    description: {
      en: 'Build a minimal design document and validate it.',
      'pt-BR': 'Monte um documento de design mínimo e valide.'
    },
    code: `const design = {
  version: 1,
  name: 'hello',
  entities: [{ name: 'Note', fields: [{ name: 'id', type: 'string' }, { name: 'text', type: 'string' }] }]
};
const result = api.validate
  ? api.validate(design)
  : { ok: true, design };
return result;`
  }
];

export const KV_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'In-memory key/value', 'pt-BR': 'Chave/valor em memória' },
    description: {
      en: 'Put and get a value with InMemoryKeyValueStorageClient.',
      'pt-BR': 'Grave e leia um valor com InMemoryKeyValueStorageClient.'
    },
    code: `const client = api.createInMemory();
await client.set('greeting', 'hello jumentix');
const value = await client.get('greeting');
return { value };`
  }
];

export const MEDIATOR_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'In-memory mediator', 'pt-BR': 'Mediator em memória' },
    description: {
      en: 'Publish a message and handle it in-process.',
      'pt-BR': 'Publique uma mensagem e trate em processo.'
    },
    code: `const seen = [];
const mediator = api.createInMemory();
await mediator.subscribe('demo.ping', async (msg) => { seen.push(msg); });
await mediator.publish('demo.ping', { hello: true });
return { seen };`
  }
];

export const MUTEX_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Mutex with in-memory KV', 'pt-BR': 'Mutex com KV em memória' },
    description: {
      en: 'Acquire and release a named lock.',
      'pt-BR': 'Adquira e libere um lock nomeado.'
    },
    code: `const mutex = api.create();
const lock = await mutex.acquire('docs-demo');
await mutex.release(lock);
return { ok: true };`
  }
];

export const REST_SDK_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'REST client with mock fetch', 'pt-BR': 'Cliente REST com fetch mock' },
    description: {
      en: 'Call a mocked OpenAPI operation without a real server.',
      'pt-BR': 'Chame uma operação OpenAPI mockada sem servidor real.'
    },
    code: `const client = api.createMockClient();
const result = await client.request({ method: 'GET', path: '/health' });
return result;`
  }
];

export const WS_SDK_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'WebSocket client with fake socket', 'pt-BR': 'Cliente WS com socket fake' },
    description: {
      en: 'Connect through an injected socket factory.',
      'pt-BR': 'Conecte via socket factory injetada.'
    },
    code: `const client = api.createFakeClient();
const status = await client.connect();
await client.disconnect();
return { status };`
  }
];

const CATALOGS: Record<DocsRuntimeId, readonly DocsSnippet[]> = {
  cana: CANA_SNIPPETS,
  'designer-core': DESIGNER_CORE_SNIPPETS,
  'key-value-storage': KV_SNIPPETS,
  'message-mediator': MEDIATOR_SNIPPETS,
  'mutex-service': MUTEX_SNIPPETS,
  'sdk-rest-client': REST_SDK_SNIPPETS,
  'sdk-websocket-client': WS_SDK_SNIPPETS
};

export function getDocsSnippet(
  runtime: DocsRuntimeId,
  id: string
): DocsSnippet | undefined {
  return CATALOGS[runtime]?.find((snippet) => snippet.id === id);
}

export function listDocsSnippets(runtime: DocsRuntimeId): readonly DocsSnippet[] {
  return CATALOGS[runtime] ?? [];
}
