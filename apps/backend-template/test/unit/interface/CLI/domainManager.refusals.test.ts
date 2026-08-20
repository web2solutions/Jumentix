import { domainManagerSubApplication } from '@src/interface/CLI/subapps/domainManager';
import type { IWorkspaceCatalog } from '@src/interface/CLI/types';

/**
 * What the domain manager refuses, and what it prints (JUM-681).
 *
 * The suite beside this one drives creating and editing a domain. These are the
 * answers nobody scripts: a create with no name, a duplicate under different
 * capitalisation, a status the operator typed wrong, a search that matched
 * nothing, and the printer's own "n/a" and "none" fallbacks for a domain with
 * no bounded context and no tags.
 *
 * The duplicate check is the one that matters most. Domains are matched by name
 * everywhere else in the CLI — an entity records `domain: "Billing"`, not an id
 * — so two domains whose names differ only in case make every later lookup
 * ambiguous, and nothing downstream would report it.
 *
 * The context is a **scripted double** of the CLI's prompt surface
 * (Requirement 135 §5/§7). The sub-application is real.
 */
const BACK = 5;

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

const domain = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  name: 'Billing',
  description: 'invoices',
  boundedContext: '',
  status: 'active',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const catalogWith = (domains: unknown[]): IWorkspaceCatalog => ({
  version: 1,
  domains,
  entities: []
} as IWorkspaceCatalog);

/** The five answers `askDomainData` reads, in order. */
const domainAnswers = (
  name: string,
  description = '',
  boundedContext = '',
  status = '',
  tags = ''
) => [name, description, boundedContext, status, tags];

describe('domain manager refusals (JUM-681)', () => {
  it('says so when nothing is registered', async () => {
    expect.hasAssertions();

    const listed = scriptedContext(catalogWith([]), [0, BACK], []);
    const updated = scriptedContext(catalogWith([]), [3, BACK], []);
    const removed = scriptedContext(catalogWith([]), [4, BACK], []);

    await domainManagerSubApplication.run(listed.context as never);
    await domainManagerSubApplication.run(updated.context as never);
    await domainManagerSubApplication.run(removed.context as never);

    expect(listed.logs).toContain('No domains registered yet.');
    expect(updated.logs).toContain('No domains available.');
    expect(removed.logs).toContain('No domains available.');
  });

  it('prints the placeholders for a domain with no context and no tags', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWith([domain()]), [0, BACK], []);

    await domainManagerSubApplication.run(run.context as never);

    expect(run.logs.join('\n')).toContain('context=n/a');
    expect(run.logs.join('\n')).toContain('tags=none');
  });

  it('refuses to create a domain with no name', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWith([]), [2, BACK], domainAnswers(''));

    await domainManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Domain name is required.');
    expect(run.saved).toHaveLength(0);
  });

  it('refuses a duplicate name that differs only in case', async () => {
    expect.hasAssertions();

    // Domains are referenced by name everywhere else in the CLI, so "billing"
    // beside "Billing" makes every later lookup ambiguous.
    const run = scriptedContext(
      catalogWith([domain()]),
      [2, BACK],
      domainAnswers('billing')
    );

    await domainManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Domain "billing" already exists.');
    expect(run.saved).toHaveLength(0);
  });

  it('falls back to draft when the typed status is not one of the three', async () => {
    expect.hasAssertions();

    // A free-text status is stored as-is by a manager that trusts it, and every
    // filter downstream then silently excludes the domain.
    const run = scriptedContext(
      catalogWith([]),
      [2, BACK],
      domainAnswers('Shipping', 'parcels', 'logistics', 'retired', 'a, b')
    );

    await domainManagerSubApplication.run(run.context as never);

    const [created] = run.saved;
    expect(created.domains).toHaveLength(1);
    expect(created.domains[0].status).toBe('draft');
    expect(created.domains[0].tags).toStrictEqual(['a', 'b']);
  });

  it('keeps the status the operator did type, when it is a real one', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWith([]),
      [2, BACK],
      domainAnswers('Shipping', '', '', 'deprecated')
    );

    await domainManagerSubApplication.run(run.context as never);

    expect(run.saved[0].domains[0].status).toBe('deprecated');
  });

  it('says so when a search matches nothing, and matches on a tag when it does', async () => {
    expect.hasAssertions();

    const missing = scriptedContext(
      catalogWith([domain()]),
      [1, BACK],
      ['nothing-like-this']
    );
    const byTag = scriptedContext(
      catalogWith([domain({ tags: ['payments'] })]),
      [1, BACK],
      ['payments']
    );

    await domainManagerSubApplication.run(missing.context as never);
    await domainManagerSubApplication.run(byTag.context as never);

    expect(missing.logs).toContain('No matching domains.');
    expect(byTag.logs).toContain('Found 1 domain(s):');
  });

  it('leaves on the back option without writing anything', async () => {
    expect.hasAssertions();

    const run = scriptedContext(catalogWith([domain()]), [BACK], []);

    await domainManagerSubApplication.run(run.context as never);

    expect(run.logs).toStrictEqual([]);
    expect(run.saved).toHaveLength(0);
  });
});
