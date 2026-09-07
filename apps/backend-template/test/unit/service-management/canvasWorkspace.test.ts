/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * The canvas features that make a large model workable (JUM-729 follow-ups).
 *
 * All of these are pure functions over the model, deliberately: search,
 * rubber-band hit-testing, alignment and the export's bounding box are the
 * parts that are wrong in ways nobody notices — a search that misses a field,
 * a band that drops the entity at its edge, a guide that snaps to the wrong
 * side, an export that crops. The DOM wiring around them is exercised in the
 * browser integration suite; the arithmetic is pinned here.
 */
const repoRoot = path.resolve(__dirname, '../../../../..');
const model = require(path.join(repoRoot, 'packages', 'designer-core', 'src', 'model', 'modelQueries.js'));
const { normalizeNote, normalizeDomainInput } = require(
  path.join(repoRoot, 'packages', 'designer-core', 'src', 'state', 'designerState.js')
);

const entity = (id: string, name: string, x: number, y: number, fields: string[] = ['id']) => ({
  id,
  name,
  x,
  y,
  fields: fields.map((fieldName) => ({ name: fieldName, type: 'string' }))
});

const domains = () => [{
  id: 'domain-1',
  name: 'Billing',
  x: 100,
  y: 100,
  entities: [
    entity('e1', 'Invoice', 20, 20, ['id', 'total']),
    entity('e2', 'Payment', 320, 20, ['id', 'invoiceId'])
  ]
}];

describe('model search (JUM-729 follow-up)', () => {
  it('finds domains, entities and fields, in reading order', () => {
    expect.hasAssertions();

    expect(model.searchModel(domains(), 'invoice').map((hit: { label: string }) => hit.label))
      .toStrictEqual([
        'Billing / Invoice',
        'Billing / Payment.invoiceId: string'
      ]);
  });

  it('matches a field by its type as well as its name', () => {
    expect.hasAssertions();

    // "which entities carry a uuid?" is a question about the model, and the
    // answer is not in any name.
    const withUuid = [{
      id: 'd',
      name: 'D',
      x: 0,
      y: 0,
      entities: [{
        id: 'e', name: 'E', x: 0, y: 0, fields: [{ name: 'ref', type: 'uuid' }]
      }]
    }];

    expect(model.searchModel(withUuid, 'uuid')).toHaveLength(1);
  });

  it('answers an empty query with nothing, not with everything', () => {
    expect.hasAssertions();

    // A blank box that lists the whole model is a wall of results the moment
    // the field is focused.
    expect(model.searchModel(domains(), '   ')).toStrictEqual([]);
  });
});

describe('rubber-band selection (JUM-729 follow-up)', () => {
  it('takes every entity the band touches, not only those it encloses', () => {
    expect.hasAssertions();

    // The band clips the right edge of the first entity and nothing else.
    const hits = model.entitiesInMarquee(
      domains(),
      {
        x1: 90, y1: 90, x2: 130, y2: 400
      },
      false,
      false
    );

    expect(hits).toStrictEqual(['e1']);
  });

  it('ignores the entities of a collapsed domain', () => {
    expect.hasAssertions();

    // They have no box on screen, so a band cannot be aimed at them and must
    // not silently pick them up.
    const collapsed = domains().map((domain) => ({ ...domain, collapsed: true }));

    expect(model.entitiesInMarquee(collapsed, {
      x1: 0, y1: 0, x2: 3000, y2: 3000
    }, false, false)).toStrictEqual([]);
  });
});

describe('alignment guides (JUM-729 follow-up)', () => {
  it('snaps a near-miss onto a sibling edge and reports the guide', () => {
    expect.hasAssertions();

    const domain = domains()[0];
    // Four pixels off the sibling's left edge: on the grid, and visibly wrong.
    const aligned = model.alignmentGuidesFor(domain, domain.entities[0], 324, 20);

    expect(aligned.x).toBe(320);
    // Both axes line up here: the sibling shares this row, so the horizontal
    // guide is as true as the vertical one and is drawn too.
    expect(aligned.guides).toStrictEqual([
      { axis: 'x', at: 420 },
      { axis: 'y', at: 120 }
    ]);
  });

  it('leaves a position that lines up with nothing alone', () => {
    expect.hasAssertions();

    const domain = domains()[0];
    const aligned = model.alignmentGuidesFor(domain, domain.entities[0], 180, 220);

    expect([aligned.x, aligned.y]).toStrictEqual([180, 220]);
    expect(aligned.guides).toStrictEqual([]);
  });
});

describe('collapsed domains (JUM-729 follow-up)', () => {
  it('draws a collapsed domain as its header', () => {
    expect.hasAssertions();

    const domain = { ...domains()[0], collapsed: true, width: 400 };

    expect(model.domainBox(domain)).toStrictEqual({ width: 400, height: 50 });
  });

  it('keeps the collapse across a save', () => {
    expect.hasAssertions();

    expect(normalizeDomainInput({ name: 'D', collapsed: true }, 0).collapsed).toBe(true);
    expect(normalizeDomainInput({ name: 'D' }, 0).collapsed).toBe(false);
  });
});

describe('canvas notes (JUM-729 follow-up)', () => {
  it('fills every field a note omits', () => {
    expect.hasAssertions();

    const note = normalizeNote({}, 2);

    expect(note.text).toBe('');
    expect(note.color).toBe('#fde68a');
    expect([note.x, note.y]).toStrictEqual([108, 108]);
    expect(note.id).toContain('note');
  });

  it('rejects a colour that is not a hex triplet', () => {
    expect.hasAssertions();

    // The value is written straight into an inline style; anything else is a
    // note that renders with no background at all.
    expect(normalizeNote({ color: 'red; background:url(x)' }, 0).color).toBe('#fde68a');
  });
});

describe('export bounds (JUM-729 follow-up)', () => {
  it('covers every domain and note, with room around them', () => {
    expect.hasAssertions();
    const { modelBounds } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'ui', 'canvasImage.js')
    );

    const bounds = modelBounds({ domains: domains(), notes: [{ x: 900, y: 700 }] });

    // A crop here is an export that silently loses part of the diagram.
    expect(bounds.x).toBeLessThanOrEqual(100);
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(1100);
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(820);
  });

  it('gives an empty model a page rather than a zero-sized image', () => {
    expect.hasAssertions();
    const { modelBounds } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'ui', 'canvasImage.js')
    );

    expect(modelBounds({ domains: [], notes: [] })).toStrictEqual({
      x: 0, y: 0, width: 800, height: 600
    });
  });
});
