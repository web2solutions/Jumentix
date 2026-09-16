/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/max-expects, jest/no-conditional-in-test */
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
const repoRoot = path.resolve(__dirname, '../../../..');
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

describe('pNG canvas export (JUM-736 release coverage)', () => {
  type CanvasCall = { method: string; args: unknown[] };

  function createCanvasHarness() {
    const calls: CanvasCall[] = [];
    const context = {
      fillStyle: '',
      strokeStyle: '',
      font: '',
      lineWidth: 0,
      beginPath: jest.fn(() => calls.push({ method: 'beginPath', args: [] })),
      moveTo: jest.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      arcTo: jest.fn((...args: unknown[]) => calls.push({ method: 'arcTo', args })),
      closePath: jest.fn(() => calls.push({ method: 'closePath', args: [] })),
      fill: jest.fn(() => calls.push({ method: 'fill', args: [] })),
      stroke: jest.fn(() => calls.push({ method: 'stroke', args: [] })),
      scale: jest.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
      translate: jest.fn((...args: unknown[]) => calls.push({ method: 'translate', args })),
      fillRect: jest.fn((...args: unknown[]) => calls.push({ method: 'fillRect', args })),
      fillText: jest.fn((...args: unknown[]) => calls.push({ method: 'fillText', args })),
      bezierCurveTo: jest.fn((...args: unknown[]) => calls.push({ method: 'bezierCurveTo', args }))
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context)
    };

    return { calls, canvas, context };
  }

  function loadCanvasImage() {
    return require(path.join(repoRoot, 'apps', 'service-management', 'src', 'ui', 'canvasImage.js'));
  }

  it('draws domains, entities, fields, notes and routed relationships', () => {
    expect.hasAssertions();
    const { drawModel } = loadCanvasImage();
    const { calls, canvas, context } = createCanvasHarness();
    const relationship = {
      id: 'rel-1',
      fromEntityId: 'entity-1',
      toEntityId: 'entity-2',
      fromCardinality: '1',
      toCardinality: 'N',
      bendX: 212
    };
    const state = {
      view: { compactEntities: false },
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        color: '#22c55e',
        x: 100,
        y: 80,
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            x: 20,
            y: 45,
            meta: { aggregateRoot: true },
            fields: [
              {
                name: 'id', type: 'uuid', pk: true, required: true, unique: true
              },
              { name: 'total', type: 'number', nullable: true }
            ]
          },
          {
            id: 'entity-2',
            name: 'Payment',
            x: 390,
            y: 45,
            fields: [{ name: 'invoiceId', type: 'uuid', fk: true }]
          }
        ]
      }],
      notes: [{
        x: 620, y: 320, color: '#fef3c7', text: 'release note\nkeeps export readable'
      }],
      relationships: [relationship]
    };

    drawModel(
      canvas,
      state,
      (candidate: unknown, end: string) => {
        expect(candidate).toBe(relationship);
        return end === 'from'
          ? { x: 460, y: 150 }
          : { x: 690, y: 150 };
      },
      { scale: 1, background: '#111827' }
    );

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(canvas.width).toBeGreaterThan(700);
    expect(canvas.height).toBeGreaterThan(400);
    expect(context.fillRect).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(calls).toContainEqual({ method: 'bezierCurveTo', args: [212, 150, 212, 150, 690, 150] });
    expect(context.fillText).toHaveBeenCalledWith('Invoice', 128, 145);
    expect(context.fillText).toHaveBeenCalledWith('AR', 438, 145);
    expect(context.fillText).toHaveBeenCalledWith('id: uuid [PK, UQ, REQ]', 128, 172, 324);
    expect(context.fillText).toHaveBeenCalledWith('total: number [NULL]', 128, 194, 324);
    expect(context.fillText).toHaveBeenCalledWith('release note', 630, 344, 180);
    expect(context.fillText).toHaveBeenCalledWith('keeps export readable', 630, 359, 180);
  });

  it('honors compact and collapsed rendering without drawing hidden rows', () => {
    expect.hasAssertions();
    const { drawModel } = loadCanvasImage();
    const { canvas, context } = createCanvasHarness();
    const state = {
      view: { compactEntities: true },
      domains: [
        {
          id: 'collapsed',
          name: 'Hidden',
          x: 0,
          y: 0,
          collapsed: true,
          entities: [{
            id: 'hidden-entity', name: 'MustNotDraw', x: 10, y: 10, fields: [{ name: 'secret' }]
          }]
        },
        {
          id: 'visible',
          name: 'Visible',
          x: 480,
          y: 0,
          entities: [{
            id: 'visible-entity', name: 'SummaryOnly', x: 10, y: 45, fields: [{ name: 'id' }]
          }]
        }
      ],
      relationships: [{ id: 'missing-endpoint' }],
      notes: []
    };

    drawModel(canvas, state, () => null);

    expect(context.fillText).toHaveBeenCalledWith('Hidden', 10, 22);
    expect(context.fillText).not.toHaveBeenCalledWith('MustNotDraw', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('SummaryOnly', 498, 65);
    expect(context.fillText).not.toHaveBeenCalledWith('id: string', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(context.bezierCurveTo).not.toHaveBeenCalled();
  });

  it('uses default colours, midpoint routing and blank fallbacks', () => {
    expect.hasAssertions();
    const { drawModel } = loadCanvasImage();
    const { canvas, context } = createCanvasHarness();

    drawModel(
      canvas,
      {
        domains: [{
          id: 'domain-1',
          name: 'Single',
          x: 20,
          y: 20,
          entities: [{
            id: 'entity-1', name: 'One', x: 12, y: 45
          }]
        }],
        notes: [{ x: 360, y: 40 }],
        relationships: [{ id: 'rel-1' }]
      },
      (_relationship: unknown, end: string) => (end === 'from' ? { x: 60, y: 90 } : { x: 160, y: 130 })
    );

    expect(context.fillText).toHaveBeenCalledWith('1 entity', expect.any(Number), 42);
    expect(context.bezierCurveTo).toHaveBeenCalledWith(110, 90, 110, 130, 160, 130);
    expect(context.fillText).toHaveBeenCalledWith('', 66, 84);
    expect(context.fillText).toHaveBeenCalledWith('', 166, 124);
  });

  it('draws sparse states without assuming optional arrays exist', () => {
    expect.hasAssertions();
    const { drawModel } = loadCanvasImage();
    const { canvas, context } = createCanvasHarness();

    drawModel(
      canvas,
      {
        domains: [{
          id: 'empty-domain', name: 'Empty', x: 16, y: 24
        }],
        // Relationships and notes are intentionally omitted. The PNG export is
        // also used while a model is being assembled and must be able to render
        // that half-shaped state rather than throwing or drawing phantom rows.
        view: {}
      },
      () => {
        throw new Error('no relationships should be resolved for a sparse state');
      }
    );

    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(context.fillText).toHaveBeenCalledWith('Empty', 26, 46);
    expect(context.fillText).toHaveBeenCalledWith('0 entities', expect.any(Number), 46);
    expect(context.bezierCurveTo).not.toHaveBeenCalled();
  });

  it('exports a completely empty partial state as a blank page', () => {
    expect.hasAssertions();
    const { drawModel } = loadCanvasImage();
    const { canvas, context } = createCanvasHarness();

    drawModel(canvas, {}, () => ({ x: 0, y: 0 }));

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(context.fillText).not.toHaveBeenCalled();
  });
});
