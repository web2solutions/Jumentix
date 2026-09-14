import { entityModelManagerSubApplication } from '@src/interface/CLI/subapps/entityModelManager';
import type { IWorkspaceCatalog } from '@src/interface/CLI/types';

/**
 * The entity manager driven all the way through (JUM-681).
 *
 * The refusal suite beside this one stops at the first "no". These run the
 * flows to the end: creating an entity with a typed field and a validation
 * rule, editing that field, previewing the schema it generates, validating a
 * payload against it, and deleting with the typed confirmation.
 *
 * That end is where this tool's real output is. Everything the designer, the
 * codegen and the OpenAPI export read comes from the catalog these flows write,
 * so a field whose `required` answer is dropped, a validation whose value never
 * reaches the rule string, or a delete that removes the wrong index all produce
 * a catalog that looks fine and generates the wrong contract.
 *
 * The context is a **scripted double** of the CLI's prompt surface
 * (Requirement 135 §5/§7): `choose` and `ask` answer from queues in the order
 * the sub-application asks. The sub-application, the OpenAPI schema mapping and
 * the payload validation are real.
 */
const BACK = 6;
const FIELDS_BACK = 8;

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

const catalogWithDomain = (): IWorkspaceCatalog => ({
  version: 1,
  domains: [{
    id: 'd1',
    name: 'Billing',
    description: '',
    boundedContext: '',
    status: 'active',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }],
  entities: []
});

const catalogWithEntity = (fields: unknown[] = []): IWorkspaceCatalog => ({
  ...catalogWithDomain(),
  entities: [{
    id: 'e1',
    name: 'Invoice',
    domain: 'Billing',
    kind: 'entity',
    description: 'a customer invoice',
    fields,
    behaviors: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }]
} as IWorkspaceCatalog);

const numberField = () => ({
  name: 'total',
  type: 'number',
  required: true,
  format: '',
  defaultValue: '',
  validations: ['minimum:10'],
  behavior: ''
});

describe('entity manager flows (JUM-681)', () => {
  it('creates an entity with a typed, validated field', async () => {
    expect.hasAssertions();

    // create → kind entity → domain Billing → type number → format none →
    // add validation → minimum → finish → back.
    const run = scriptedContext(
      catalogWithDomain(),
      [2, 0, 0, 1, 0, 0, 0, 1, BACK],
      ['Invoice', 'a customer invoice', '', 'total', 'y', '', '', '10', 'n', 'calculate,print']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    const [created] = run.saved;
    expect(created.entities).toHaveLength(1);
    expect(created.entities[0].fields).toStrictEqual([{
      name: 'total',
      type: 'number',
      required: true,
      format: '',
      defaultValue: '',
      validations: ['minimum:10'],
      behavior: ''
    }]);
    expect(created.entities[0].behaviors).toStrictEqual(['calculate', 'print']);
  });

  it('skips a validation whose value was left blank', async () => {
    expect.hasAssertions();

    // A rule with no value would be stored as "minimum:" and generate a schema
    // keyword set to the empty string.
    const run = scriptedContext(
      catalogWithDomain(),
      [2, 0, 0, 1, 0, 0, 0, 1, BACK],
      ['Invoice', '', '', 'total', '', '', '', '', 'n', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs.join('\n')).toContain('Validation "minimum" skipped because value is empty.');
    expect(run.saved[0].entities[0].fields[0].validations).toStrictEqual([]);
  });

  it('records a field the operator marked as not required', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithDomain(),
      [2, 0, 0, 0, 0, 1, BACK],
      ['Invoice', '', '', 'note', 'n', '', '', 'n', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].fields[0].required).toBe(false);
  });

  it('treats an unanswered "Required?" as not required, though the prompt reads (y)', async () => {
    expect.hasAssertions();

    // Recorded rather than corrected. The prompt is
    // `Required? y|n (y)` — the parenthesis is the CLI's convention for the
    // default — and an empty answer produces `required: false`, because the
    // fallback is `initial?.required ? 'y' : 'n'` and a new field has no
    // initial. Whoever changes this should change the label or the fallback
    // deliberately, with the designer's stored catalogs in mind; a test that
    // asserted the label's promise would have been asserting a fix nobody made.
    const run = scriptedContext(
      catalogWithDomain(),
      [2, 0, 0, 0, 0, 1, BACK],
      ['Invoice', '', '', 'note', '', '', '', 'n', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].fields[0].required).toBe(false);
  });

  it('creates against a typed domain when the catalog has none registered', async () => {
    expect.hasAssertions();

    // No domains: the prompt is free text rather than a list, and the typed
    // value has to reach the entity.
    const empty: IWorkspaceCatalog = { version: 1, domains: [], entities: [] };
    const run = scriptedContext(empty, [2, 0, BACK], ['Invoice', 'Billing', '', 'n', '']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].domain).toBe('Billing');
  });

  it('updates an entity, keeping the fields it was not asked about', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([numberField()]),
      [3, 0, 3, 0, BACK],
      ['Receipt', '', 'settle']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    const [updated] = run.saved;
    expect(updated.entities[0].name).toBe('Receipt');
    expect(updated.entities[0].fields).toHaveLength(1);
    expect(updated.entities[0].behaviors).toStrictEqual(['settle']);
  });

  it('keeps the stored domain when the typed custom domain is empty', async () => {
    expect.hasAssertions();

    // update → entity 0 → kind entity → "Type custom domain" → blank answer →
    // back. The custom-domain prompt falls back to the entity's own domain.
    const run = scriptedContext(
      catalogWithEntity(),
      [3, 0, 0, 1, BACK],
      ['', '', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].domain).toBe('Billing');
  });

  it('keeps an empty stored domain empty when the typed custom domain is also empty', async () => {
    expect.hasAssertions();

    const catalog = catalogWithEntity();
    catalog.entities[0].domain = '';
    const run = scriptedContext(
      catalog,
      [3, 0, 0, 1, BACK],
      ['', '', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].domain).toBe('');
  });

  it('deletes only on the typed confirmation', async () => {
    expect.hasAssertions();

    const cancelled = scriptedContext(catalogWithEntity(), [4, 0, BACK], ['not-the-name']);
    const confirmed = scriptedContext(catalogWithEntity(), [4, 0, BACK], ['Invoice']);

    await entityModelManagerSubApplication.run(cancelled.context as never);
    await entityModelManagerSubApplication.run(confirmed.context as never);

    expect(cancelled.logs).toContain('Delete cancelled.');
    expect(cancelled.saved).toHaveLength(0);
    expect(confirmed.saved[0].entities).toStrictEqual([]);
  });

  it('lists fields, and says so when there are none', async () => {
    expect.hasAssertions();

    const empty = scriptedContext(catalogWithEntity(), [5, 0, 0, FIELDS_BACK, BACK], []);
    const withField = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 0, FIELDS_BACK, BACK],
      []
    );

    await entityModelManagerSubApplication.run(empty.context as never);
    await entityModelManagerSubApplication.run(withField.context as never);

    expect(empty.logs).toContain('No fields defined.');
    expect(withField.logs.join('\n')).toContain('- total: number (required) | validations=minimum:10');
  });

  it('shows the details of a chosen field', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 1, 0, FIELDS_BACK, BACK],
      []
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs.join('\n')).toContain('Field: total');
    expect(run.logs.join('\n')).toContain('  required: yes');
  });

  it('adds a field to an entity that had none', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity(),
      [5, 0, 2, 0, 0, 1, FIELDS_BACK, BACK],
      ['reference', '', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].fields[0].name).toBe('reference');
    expect(run.logs.join('\n')).toContain('added');
  });

  it('edits a field behavior without touching the rest of it', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 4, 0, FIELDS_BACK, BACK],
      ['computed on write']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    const [field] = run.saved[0].entities[0].fields;
    expect(field.behavior).toBe('computed on write');
    expect(field.validations).toStrictEqual(['minimum:10']);
  });

  it('deletes a field, and says so when there is none to delete', async () => {
    expect.hasAssertions();

    const empty = scriptedContext(catalogWithEntity(), [5, 0, 5, FIELDS_BACK, BACK], []);
    const removed = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 5, 0, FIELDS_BACK, BACK],
      []
    );

    await entityModelManagerSubApplication.run(empty.context as never);
    await entityModelManagerSubApplication.run(removed.context as never);

    expect(empty.logs).toContain('No fields to delete.');
    expect(removed.saved[0].entities[0].fields).toStrictEqual([]);
  });

  it('previews the OpenAPI schema the entity generates', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 6, FIELDS_BACK, BACK],
      []
    );

    await entityModelManagerSubApplication.run(run.context as never);

    // The generated schema is what the codegen and the exporters consume, so
    // the preview has to be the real mapping rather than a summary of it.
    const printed = run.logs.join('\n');
    expect(printed).toContain('"minimum": 10');
    expect(printed).toContain('"required"');
  });

  it('validates a sample payload against the generated schema, both ways', async () => {
    expect.hasAssertions();

    const valid = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 7, FIELDS_BACK, BACK],
      ['{"total": 20}']
    );
    const invalid = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 7, FIELDS_BACK, BACK],
      ['{"total": 2}']
    );
    const empty = scriptedContext(
      catalogWithEntity([numberField()]),
      [5, 0, 7, FIELDS_BACK, BACK],
      ['   ']
    );

    await entityModelManagerSubApplication.run(valid.context as never);
    await entityModelManagerSubApplication.run(invalid.context as never);
    await entityModelManagerSubApplication.run(empty.context as never);

    expect(valid.logs).toContain('Payload is valid against generated OpenAPI schema.');
    expect(invalid.logs.join('\n')).toContain('Validation failed:');
    expect(empty.logs).toContain('Sample payload is required.');
  });
});

/**
 * Editing what is already there, and printing it (JUM-681).
 *
 * Creating a field asks every question against an empty slate. Editing one asks
 * the same questions with the stored answer in the prompt, and every "keep what
 * is there" is a fallback of its own: an empty answer must leave the name, the
 * format, the behaviour and the description as they were, not blank them.
 *
 * The printers have the same shape. A field that is optional and carries no
 * rules is the common case, and it is the one whose summary reads
 * `validations=undefined` when the fallback is missing.
 */
describe('entity manager edits and printers (JUM-681)', () => {
  const optionalField = () => ({
    name: 'note',
    type: 'string',
    required: false,
    format: 'uuid',
    defaultValue: 'n/a',
    validations: [],
    behavior: 'free text'
  });

  it('prints an optional field with no rules as optional and ruleless', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([optionalField()]),
      [5, 0, 0, 1, 0, FIELDS_BACK, BACK],
      []
    );

    await entityModelManagerSubApplication.run(run.context as never);

    const printed = run.logs.join('\n');
    expect(printed).toContain('- note: string | validations=none');
    expect(printed).toContain('  required: no');
    expect(printed).toContain('  validations: none');
  });

  it('keeps every stored answer when the edit is all empty', async () => {
    expect.hasAssertions();

    // Update field → choose the field → keep the type (index 0, string) and the
    // format (index 18, uuid, the stored one), answering every text prompt with
    // nothing. The format is chosen by index because the prompt is a list: the
    // stored value is shown as "(current)" but still has to be picked.
    const run = scriptedContext(
      catalogWithEntity([optionalField()]),
      [5, 0, 3, 0, 0, 18, 1, FIELDS_BACK, BACK],
      ['', '', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    const [saved] = run.saved;
    expect(saved.entities[0].fields[0]).toStrictEqual(optionalField());
  });

  it('keeps the stored behaviour when the behaviour edit is empty', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([optionalField()]),
      [5, 0, 4, 0, FIELDS_BACK, BACK],
      ['']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].fields[0].behavior).toBe('free text');
  });

  it('refuses a second field with the same name in another case', async () => {
    expect.hasAssertions();

    // Field names become OpenAPI property names, so two that differ only in
    // case produce a schema with one of them silently overwriting the other.
    const run = scriptedContext(
      catalogWithEntity([optionalField()]),
      [5, 0, 2, 0, 0, 1, FIELDS_BACK, BACK],
      ['NOTE', '', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs.join('\n')).toContain('already exists');
    expect(run.saved).toHaveLength(0);
  });

  it('keeps the stored description when the update leaves it empty', async () => {
    expect.hasAssertions();

    const run = scriptedContext(
      catalogWithEntity([optionalField()]),
      [3, 0, 0, 0, BACK],
      ['', '', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].description).toBe('a customer invoice');
  });

  it('takes a typed domain over the list when the operator asks for one', async () => {
    expect.hasAssertions();

    // The last option of the domain chooser is "Type custom domain"; the index
    // that selects it is the length of the list, which is exactly the boundary
    // an off-by-one gets wrong — and getting it wrong files the entity under a
    // domain the operator did not pick.
    const run = scriptedContext(
      catalogWithDomain(),
      [2, 0, 1, BACK],
      ['Invoice', 'Logistics', '', 'n', '']
    );

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].domain).toBe('Logistics');
  });
});

/**
 * The empty-on-empty answers (JUM-721).
 *
 * Every "keep what is there" fallback has a third arm for when there is nothing
 * to keep either: an entity with no description, a field with no behaviour, a
 * custom domain prompt answered with nothing. Those arms are what stop the
 * catalog gaining `undefined` where it should hold an empty string — a
 * difference the designer renders as the word "undefined" and the exporters
 * write into a contract.
 */
describe('entity manager empty answers (JUM-721)', () => {
  const bareEntity = () => ({
    ...catalogWithEntity([{
      name: 'note',
      type: 'string',
      required: false,
      format: '',
      defaultValue: '',
      validations: [],
      behavior: ''
    }])
  });

  const withoutDescription = () => {
    const catalog = bareEntity();
    catalog.entities[0].description = '';
    return catalog;
  };

  it('keeps an empty description empty rather than undefined', async () => {
    expect.hasAssertions();

    const run = scriptedContext(withoutDescription(), [3, 0, 0, 0, BACK], ['', '', '']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].description).toBe('');
    expect(run.saved[0].entities[0].behaviors).toStrictEqual([]);
  });

  it('keeps an empty behaviour empty rather than undefined', async () => {
    expect.hasAssertions();

    const run = scriptedContext(bareEntity(), [5, 0, 4, 0, FIELDS_BACK, BACK], ['']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.saved[0].entities[0].fields[0].behavior).toBe('');
  });

  it('refuses a create whose typed domain is also empty', async () => {
    expect.hasAssertions();

    // The custom-domain prompt with nothing typed and nothing to fall back on:
    // the create stops rather than filing the entity under "".
    const empty: IWorkspaceCatalog = { version: 1, domains: [], entities: [] };
    const run = scriptedContext(empty, [2, 0, BACK], ['Invoice', '']);

    await entityModelManagerSubApplication.run(run.context as never);

    expect(run.logs).toContain('Domain is required.');
    expect(run.saved).toHaveLength(0);
  });
});
