/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

function loadSwaggerTabModule() {
  if (typeof jest.resetModules === 'function') {
    jest.resetModules();
  }
  const modulePath = require.resolve('../../src/ui/swaggerTab.js');
  delete require.cache[modulePath];
  return require('../../src/ui/swaggerTab.js');
}

function sampleState() {
  return {
    domains: [{
      id: 'domain-users',
      name: 'Users',
      entities: [{
        id: 'entity-user',
        name: 'User',
        fields: [{
          name: 'id',
          type: 'uuid',
          required: true,
          pk: true
        }]
      }]
    }],
    relationships: [],
    architecture: {
      services: [{
        id: 'core',
        name: 'Core',
        kind: 'core',
        domains: ['domain-users'],
        url: 'http://localhost:3000/api/1.0.0'
      }],
      links: []
    }
  };
}

function installDocument({ hasCss = false } = {}) {
  const appended: any[] = [];
  const document = {
    head: {
      appendChild: jest.fn((node) => {
        appended.push(node);
      })
    },
    createElement: jest.fn((tag) => ({
      tagName: String(tag).toUpperCase(),
      dataset: {},
      appendChild: jest.fn()
    })),
    querySelector: jest.fn(() => (hasCss ? { dataset: { swaggerUi: 'true' } } : null))
  };
  globalThis.document = document as any;
  return { document, appended };
}

function makeSelect(initialValue = 'merged') {
  const listeners: Record<string, Function> = {};
  const options: any[] = [];
  return {
    value: initialValue,
    innerHTML: 'stale',
    appendChild: jest.fn((option) => {
      options.push(option);
    }),
    addEventListener: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    listeners,
    options
  };
}

describe('swagger tab service selector (JUM-818)', () => {
  afterEach(() => {
    delete (globalThis as any).SwaggerUIBundle;
    delete (globalThis as any).document;
  });

  it('returns the merged document or a per-service filter', () => {
    expect.hasAssertions();
    const { selectOasForService } = loadSwaggerTabModule();
    const documentSet = {
      merged: { info: { title: 'Merged' }, paths: { '/a': {} } },
      services: {
        core: { info: { title: 'Core' }, paths: { '/users': {} } }
      }
    };
    expect(selectOasForService(documentSet, 'merged').info.title).toBe('Merged');
    expect(selectOasForService(documentSet, 'core').info.title).toBe('Core');
    expect(selectOasForService(documentSet, 'missing').info.title).toBe('Merged');
    expect(selectOasForService({ merged: documentSet.merged }, undefined).info.title).toBe('Merged');
  });

  it('loads swagger-ui assets, fills service choices and updates an existing UI instance', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    const { appended } = installDocument();
    const updateSpec = jest.fn();
    const bundle = Object.assign(jest.fn(() => ({
      specActions: { updateSpec }
    })), {
      presets: { apis: 'apis-preset' }
    });
    const select = makeSelect('core');
    const dom = {
      openapiServiceSelect: select,
      openapiRefreshBtn: { addEventListener: jest.fn() },
      swaggerUi: { textContent: '' }
    };
    const tab = createSwaggerTab({ dom, state: sampleState() });
    const render = tab.renderSwagger();
    (globalThis as any).SwaggerUIBundle = bundle;
    appended.find((node) => node.src?.includes('swagger-ui-bundle')).onload();
    await render;

    expect(appended.some((node) => node.src === './vendor/swagger-ui/swagger-ui-bundle.js')).toBe(true);
    expect(appended.some((node) => node.href === './vendor/swagger-ui/swagger-ui.css')).toBe(true);
    expect(select.options.map((option) => option.value)).toStrictEqual(['merged', 'core']);
    expect(bundle).toHaveBeenCalledWith(expect.objectContaining({
      dom_id: '#swagger-ui',
      layout: 'BaseLayout',
      tryItOutEnabled: true
    }));

    select.value = 'merged';
    await tab.renderSwagger();
    expect(updateSpec).toHaveBeenCalledWith(expect.stringContaining('"openapi":"3.1.0"'));
  });

  it('renders immediately with a preloaded bundle and no optional selector controls', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    installDocument({ hasCss: true });
    const bundle = Object.assign(jest.fn(() => ({})), {
      presets: { apis: 'apis-preset' }
    });
    (globalThis as any).SwaggerUIBundle = bundle;
    const tab = createSwaggerTab({ dom: { swaggerUi: { textContent: '' } }, state: sampleState() });
    await tab.renderSwagger();
    expect(bundle).toHaveBeenCalledTimes(1);
  });

  it('shows a deterministic message when the vendored swagger-ui bundle fails', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    const { appended } = installDocument({ hasCss: true });
    const dom = {
      openapiServiceSelect: makeSelect('merged'),
      swaggerUi: { textContent: '' }
    };
    const tab = createSwaggerTab({ dom, state: sampleState() });
    const render = tab.renderSwagger();
    appended.find((node) => node.src?.includes('swagger-ui-bundle')).onerror();
    await render;
    expect(dom.swaggerUi.textContent).toContain('Failed to load swagger-ui-bundle.js');
  });

  it('reports a missing global when the swagger script loads without registering the bundle', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    const { appended } = installDocument({ hasCss: true });
    const dom = {
      openapiRefreshBtn: { addEventListener: jest.fn() },
      swaggerUi: { textContent: '' }
    };
    const tab = createSwaggerTab({ dom, state: sampleState() });
    const render = tab.renderSwagger();
    appended.find((node) => node.src?.includes('swagger-ui-bundle')).onload();
    await render;
    expect(dom.swaggerUi.textContent).toContain('SwaggerUIBundle missing after script load');
  });

  it('normalizes non-Error swagger renderer failures', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    installDocument({ hasCss: true });
    (globalThis as any).SwaggerUIBundle = Object.assign(jest.fn(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'renderer unavailable';
    }), {
      presets: { apis: 'apis-preset' }
    });
    const dom = { swaggerUi: { textContent: '' } };
    await createSwaggerTab({ dom, state: sampleState() }).renderSwagger();
    expect(dom.swaggerUi.textContent).toContain('renderer unavailable');
  });

  it('reuses an in-flight bundle load and wires selector controls to rerender', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    const { appended } = installDocument();
    const updateSpec = jest.fn();
    const bundle = Object.assign(jest.fn(() => ({
      specActions: { updateSpec }
    })), {
      presets: { apis: 'apis-preset' }
    });
    const select = makeSelect('merged');
    const refresh: any = {
      addEventListener: jest.fn((event, handler) => {
        refresh[event] = handler;
      })
    };
    const dom = {
      openapiServiceSelect: select,
      openapiRefreshBtn: refresh,
      swaggerUi: { textContent: '' }
    };
    const tab = createSwaggerTab({ dom, state: sampleState() });
    const first = tab.renderSwagger();
    const second = tab.renderSwagger();
    expect(appended.filter((node) => node.src?.includes('swagger-ui-bundle'))).toHaveLength(1);
    (globalThis as any).SwaggerUIBundle = bundle;
    appended.find((node) => node.src?.includes('swagger-ui-bundle')).onload();
    await Promise.all([first, second]);
    select.listeners.change();
    await Promise.resolve();
    refresh.click();
    await Promise.resolve();
    expect(bundle).toHaveBeenCalledTimes(1);
    expect(updateSpec).toHaveBeenCalledWith(expect.stringContaining('"openapi":"3.1.0"'));
  });

  it('skips rendering when the swagger container is absent', async () => {
    expect.hasAssertions();
    const { createSwaggerTab } = loadSwaggerTabModule();
    installDocument();
    const tab = createSwaggerTab({ dom: {}, state: sampleState() });
    await tab.renderSwagger();
    expect(document.head.appendChild).not.toHaveBeenCalled();
  });
});
