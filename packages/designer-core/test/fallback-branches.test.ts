/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import path from 'node:path';

const packageRoot = path.resolve(__dirname, '..');

const {
  normalizeCodeWorkspaceInput,
  normalizeEntityInput,
  normalizeNote
} = require(path.join(packageRoot, 'src', 'state', 'designerState.js')) as {
  normalizeCodeWorkspaceInput: (input: unknown) => {
    files: Record<string, {
      path: string;
      state: string;
      baseContent: string;
      content: string;
    }>;
  };
  normalizeEntityInput: (input: unknown, index: number) => { width: number; height?: number };
  normalizeNote: (input: unknown, index: number) => {
    id: string;
    x: number;
    y: number;
    color: string;
  };
};

const {
  buildBoilerplateBundleDocument
} = require(path.join(packageRoot, 'src', 'exporters', 'designerExporters.js')) as {
  buildBoilerplateBundleDocument: (state: Record<string, unknown>, generatedAt?: string) => {
    modules: Array<{
      entities: Array<{
        files: Record<string, {
          content: string;
          workspaceState?: string;
        }>;
      }>;
    }>;
  };
};

const {
  searchModel,
  resizeDomainBox
} = require(path.join(packageRoot, 'src', 'model', 'modelQueries.js')) as {
  searchModel: (domains: unknown, query: unknown) => unknown[];
  resizeDomainBox: (domain: unknown, width: number, height: number) => {
    width: number;
    height: number;
  };
};

const {
  isBarePropertyKey
} = require(path.join(packageRoot, 'src', 'model', 'propertyKeys.js')) as {
  isBarePropertyKey: (name: unknown) => boolean;
};

describe('designer-core fallback branches', () => {
  it('normalizes missing note coordinates and colour inside the package owner suite', () => {
    expect.hasAssertions();

    const note = normalizeNote({}, 2);

    expect(note.id).toMatch(/^note-import-2-/);
    expect(note).toMatchObject({
      x: 108,
      y: 108,
      color: '#fde68a'
    });
  });

  it('keeps explicit note coordinates and colours when they are valid', () => {
    expect.hasAssertions();

    const note = normalizeNote({
      id: 'note-a',
      text: ' Decision ',
      x: 12,
      y: 34,
      color: '#abcdef'
    }, 0);

    expect(note).toMatchObject({
      id: 'note-a',
      text: 'Decision',
      x: 12,
      y: 34,
      color: '#abcdef'
    });
  });

  it('normalizes generated workspace files from sparse overlays', () => {
    expect.hasAssertions();

    const normalized = normalizeCodeWorkspaceInput({
      files: {
        'src/modules/Billing/domain/Model/Invoice.ts': {
          state: 'unknown',
          generatedContent: 'generated model'
        }
      }
    });

    expect(normalized.files['src/modules/Billing/domain/Model/Invoice.ts']).toStrictEqual({
      path: 'src/modules/Billing/domain/Model/Invoice.ts',
      state: 'generated',
      baseContent: 'generated model',
      generatedContent: 'generated model',
      content: 'generated model',
      updatedAt: ''
    });
  });

  it('normalizes an empty workspace file overlay without inheriting a false path', () => {
    expect.hasAssertions();

    const normalized = normalizeCodeWorkspaceInput({
      files: {
        'src/modules/Billing/domain/Model/Invoice.ts': null
      }
    });

    expect(normalized.files['src/modules/Billing/domain/Model/Invoice.ts']).toStrictEqual({
      path: 'src/modules/Billing/domain/Model/Invoice.ts',
      state: 'generated',
      baseContent: '',
      generatedContent: '',
      content: '',
      updatedAt: ''
    });
  });

  it('builds boilerplate bundles when no code workspace overlay exists', () => {
    expect.hasAssertions();
    const state = {
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [{
          id: 'entity-1',
          name: 'Invoice',
          fields: [{
            id: 'field-1',
            name: 'id',
            type: 'uuid',
            primary: true,
            required: true
          }]
        }]
      }],
      relationships: []
    };

    const document = buildBoilerplateBundleDocument(state, '2026-09-07T00:00:00.000Z');

    expect(document.modules[0].entities[0].files.model.content).toContain('export class Invoice');
  });

  it('keeps boilerplate overlays safe when a stale file has no edited content', () => {
    expect.hasAssertions();
    const state = {
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [{
          id: 'entity-1',
          name: 'Invoice',
          fields: [{
            id: 'field-1',
            name: 'id',
            type: 'uuid',
            primary: true,
            required: true
          }]
        }]
      }],
      relationships: [],
      codeWorkspace: {
        files: {
          'src/modules/Billing/domain/Model/Invoice.ts': {
            path: 'src/modules/Billing/domain/Model/Invoice.ts',
            state: 'stale'
          }
        }
      }
    };

    const document = buildBoilerplateBundleDocument(state, '2026-09-07T00:00:00.000Z');
    const file = document.modules[0].entities[0].files.model;

    expect(file.content).toContain('export class Invoice');
    expect(file.workspaceState).toBe('stale');
  });

  it('defaults absent entity dimensions and clamps sparse domain resize inputs', () => {
    expect.hasAssertions();

    expect(normalizeEntityInput({}, 0).height).toBeUndefined();
    expect(normalizeEntityInput({ height: 444 }, 0).height).toBe(444);
    expect(resizeDomainBox({ entities: [{ x: Number.NaN, y: Number.NaN }] }, 12, 16))
      .toStrictEqual({ width: 356, height: 160 });
  });

  it('keeps model search and property key nullish fallbacks explicit', () => {
    expect.hasAssertions();

    expect(searchModel([], '')).toStrictEqual([]);
    expect(isBarePropertyKey(null)).toBe(false);
  });
});
