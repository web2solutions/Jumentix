import { entityModelManagerSubApplication } from '@src/interface/CLI/subapps/entityModelManager';
import type { IWorkspaceCatalog } from '@src/interface/CLI/types';

/**
 * What the entity manager refuses, and what it says (JUM-681).
 *
 * The suite beside this one drives the flows that succeed: create an entity,
 * edit a field, generate a schema. Every branch here is the other answer — a
 * required value the operator left blank, a search that matched nothing, a menu
 * entry chosen against an empty catalog.
 *
 * They are worth pinning because this is an interactive tool with no undo
 * visible to the user: a create that silently produces an entity named ""
 * corrupts the catalog file the rest of the CLI reads, and a "no fields to
 * delete" path that falls through to `fields[undefined]` takes the session down
 * mid-edit.
 *
 * The context is a **scripted double** of the CLI's own prompt surface
 * (Requirement 135 §5/§7): `choose` and `ask` answer from queues, `log`
 * collects, and `loadCatalog`/`saveCatalog` stand in for the catalog file. The
 * sub-application is real.
 */
const BACK = 6;

/** A context whose prompts answer from queues, and the transcript it produced. */
function scriptedContext(catalog: IWorkspaceCatalog, chooses: number[], asks: string[]) {
  const logs: string[] = [];
  const saved: IWorkspaceCatalog[] = [];
  let chooseIndex = 0;
  let askIndex = 0;

  return {
    logs,
    saved,
    context: {
      choose: async () => {
        const value = chooses[chooseIndex];
        chooseIndex += 1;
        return value;
      },
      ask: async () => {
        const value = askIndex < asks.length ? asks[askIndex] : '';
        askIndex += 1;
        return value;
      },
      log: (message: string) => { logs.push(message); },
      loadCatalog: async () => catalog,
      saveCatalog: async (next: IWorkspaceCatalog) => { saved.push(next); }
    }
  };
}

const emptyCatalog = (): IWorkspaceCatalog => ({
  version: 1,
  domains: [],
  entities: []
});

const catalogWithEntity = (): IWorkspaceCatalog => ({
  version: 1,
  domains: [{
    id: 'd1',
    name: 'Billing',
    description: 'invoices and payments',
    boundedContext: '',
    status: 'active',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }],
  entities: [{
    id: 'e1',
    name: 'Invoice',
    domain: 'Billing',
    kind: 'entity',
    description: 'a customer invoice',
    fields: [],
    behaviors: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }]
});

describe('entity manager refusals (JUM-681)', () => {
  it('says so when there is nothing registered', async () => {
    expect.hasAssertions();

    const run = scriptedContext(emptyCatalog(), [0, BACK], []);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('No entities/models registered.');
  });

  it('says so when a search matches nothing', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWithEntity(), [1, BACK], ['nothing-like-this']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('No matching entities/models.');
  });

  it('matches a search on the domain, not only on the name', async () => {
    expect.hasAssertions();

    // Four fields feed the filter — name, domain, kind, description — and a
    // search that only ever reads `name` would look identical on the entity
    // above, whose name and domain both contain "i".
    const run = scriptedContext(catalogWithEntity(), [1, BACK], ['billing']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Found 1 item(s):');
  });

  it('matches a search on the description', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWithEntity(), [1, BACK], ['customer invoice']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Found 1 item(s):');
  });

  it('refuses to create an entity with no name', async () => {
    expect.hasAssertions();

    // The catalog is never written: an entity named "" is a record the rest of
    // the CLI cannot select, delete or repair.
    const run = scriptedContext(emptyCatalog(), [2, BACK], ['']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Name is required.');
    expect(run.saved).toHaveLength(0);
  });

  it('refuses to create an entity with no domain', async () => {
    expect.hasAssertions();

    // No domains registered, so the prompt falls back to a free-text one — and
    // an empty answer there has to stop the create rather than file the entity
    // under "".
    const run = scriptedContext(emptyCatalog(), [2, 0, BACK], ['Invoice', '']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Domain is required.');
    expect(run.saved).toHaveLength(0);
  });

  it('says so when there is nothing to update or delete', async () => {
    expect.hasAssertions();

    const update = scriptedContext(emptyCatalog(), [3, BACK], []);
    const remove = scriptedContext(emptyCatalog(), [4, BACK], []);
    const fields = scriptedContext(emptyCatalog(), [5, BACK], []);

    await entityModelManagerSubApplication.run(update.context as never);
    await entityModelManagerSubApplication.run(remove.context as never);
    await entityModelManagerSubApplication.run(fields.context as never);

    expect(update.logs.join('\n')).toContain('No entities');
    expect(remove.logs.join('\n')).toContain('No entities');
    expect(fields.logs.join('\n')).toContain('No entities');
  });

  it('leaves on the back option without touching the catalog', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWithEntity(), [BACK], []);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toStrictEqual([]);
    expect(run.saved).toHaveLength(0);
  });
});
