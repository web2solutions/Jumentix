/* eslint-disable @typescript-eslint/no-var-requires, object-curly-newline */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/**
 * JUM-922 — cover hierarchical selection + exclusive sidebar expand maps that
 * landed with JUM-918 and were dragging global branch coverage below 98%.
 */
const {
  emptySelection,
  normalizeSelection,
  selectionToFlatIds,
  normalizeMultiSidebarExpanded,
  normalizeRelationship,
  clampZoom,
  CANONICAL_SIDEBAR_GROUP_KEYS,
  MODEL_SCHEMA_VERSION
} = require('@jumentix/designer-core/state/designerState.js');

const domains = [
  {
    id: 'd1',
    name: 'Users',
    entities: [
      { id: 'e1', name: 'User', fields: [{ name: 'email', type: 'string' }] },
      { id: 'e2', name: 'Org', fields: [] }
    ]
  },
  {
    id: 'd2',
    name: 'Tasks',
    entities: [{ id: 'e3', name: 'Task', fields: [{ name: 'title', type: 'string' }] }]
  }
];

describe('designer selection path (JUM-922)', () => {
  it('exposes schema version and canonical sidebar keys', () => {
    expect.hasAssertions();
    expect(MODEL_SCHEMA_VERSION).toBe(2);
    expect(CANONICAL_SIDEBAR_GROUP_KEYS).toStrictEqual([
      'model', 'history', 'validate', 'export', 'import'
    ]);
    expect(emptySelection()).toMatchObject({ kind: 'none', domainId: null });
    expect(clampZoom(3)).toBe(2.5);
    expect(clampZoom(0.1)).toBe(0.25);
  });

  it('infers kind from flat ids when selection.kind is missing', () => {
    expect.hasAssertions();
    expect(normalizeSelection(null, domains, { selectedNoteId: 'n1' }).kind).toBe('note');
    expect(normalizeSelection(undefined, domains, { selectedRelationshipId: 'r1' }).kind)
      .toBe('relationship');
    expect(normalizeSelection({}, domains, {
      selectedEntityId: 'e1', selectedFieldName: 'email'
    }).kind).toBe('field');
    expect(normalizeSelection({}, domains, { selectedEntityId: 'e1' }).kind).toBe('entity');
    expect(normalizeSelection({}, domains, { selectedDomainId: 'd1' }).kind).toBe('domain');
    expect(normalizeSelection('x', domains, {}).kind).toBe('none');
  });

  it('lets flat note/relationship ids override a stale domain kind', () => {
    expect.hasAssertions();
    expect(normalizeSelection(
      { kind: 'domain', domainId: 'd1' },
      domains,
      { selectedNoteId: 'n9' }
    )).toMatchObject({ kind: 'note', noteId: 'n9', domainId: 'd1' });
    expect(normalizeSelection(
      { kind: 'domain', domainId: 'd1' },
      domains,
      { selectedRelationshipId: 'r9' }
    )).toMatchObject({ kind: 'relationship', relationshipId: 'r9' });
  });

  it('preserves incomplete paths when the domain tree is empty', () => {
    expect.hasAssertions();
    expect(normalizeSelection(
      { kind: 'entity', entityId: 'e1', domainId: 'd1' },
      [],
      {}
    )).toMatchObject({ kind: 'entity', entityId: 'e1', domainId: 'd1' });
    expect(normalizeSelection(
      { kind: 'field', entityId: 'e1', fieldName: 'email' },
      null,
      {}
    )).toMatchObject({ kind: 'field', fieldName: 'email' });
    expect(normalizeSelection(
      { kind: 'relationship', relationshipId: 'r1' },
      [],
      {}
    )).toMatchObject({ kind: 'relationship', relationshipId: 'r1' });
    expect(normalizeSelection(
      { kind: 'note', noteId: 'n1' },
      [],
      {}
    )).toMatchObject({ kind: 'note', noteId: 'n1' });
  });

  it('fail-closes ghost entities and invalid domain ids', () => {
    expect.hasAssertions();
    expect(normalizeSelection(
      { kind: 'entity', entityId: 'ghost', domainId: 'd1' },
      domains
    )).toMatchObject({ kind: 'domain', domainId: 'd1', entityId: null });
    expect(normalizeSelection(
      { kind: 'field', entityId: 'ghost', fieldName: 'x', domainId: 'missing' },
      domains
    )).toMatchObject({ kind: 'none', domainId: null, entityId: null, fieldName: null });
    expect(normalizeSelection(
      { kind: 'entity', entityId: 'e3', domainId: 'd1' },
      domains
    )).toMatchObject({ kind: 'entity', domainId: 'd2', entityId: 'e3' });
  });

  it('downgrades incomplete field/domain/relationship/note kinds', () => {
    expect.hasAssertions();
    expect(normalizeSelection(
      { kind: 'field', entityId: 'e1', domainId: 'd1' },
      domains
    )).toMatchObject({ kind: 'entity', entityId: 'e1', fieldName: null });
    expect(normalizeSelection(
      { kind: 'field', domainId: 'd1' },
      domains
    )).toMatchObject({ kind: 'domain', domainId: 'd1', entityId: null });
    expect(normalizeSelection(
      { kind: 'field' },
      domains
    )).toMatchObject({ kind: 'none' });
    expect(normalizeSelection(
      { kind: 'domain' },
      domains
    )).toMatchObject({ kind: 'none' });
    expect(normalizeSelection(
      { kind: 'relationship', domainId: 'd1' },
      domains
    )).toMatchObject({ kind: 'domain', domainId: 'd1', relationshipId: null });
    expect(normalizeSelection(
      { kind: 'relationship' },
      domains
    )).toMatchObject({ kind: 'none' });
    expect(normalizeSelection(
      { kind: 'note', domainId: 'd2' },
      domains
    )).toMatchObject({ kind: 'domain', domainId: 'd2', noteId: null });
    expect(normalizeSelection(
      { kind: 'note' },
      domains
    )).toMatchObject({ kind: 'none' });
  });

  it('round-trips selection to flat ids and back', () => {
    expect.hasAssertions();
    const field = normalizeSelection({
      kind: 'field', domainId: 'd1', entityId: 'e1', fieldName: 'email'
    }, domains);
    expect(selectionToFlatIds(field)).toStrictEqual({
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      selectedFieldName: 'email',
      selectedRelationshipId: null,
      selectedNoteId: null
    });
    expect(selectionToFlatIds(null)).toMatchObject({
      selectedDomainId: null,
      selectedEntityId: null
    });
    expect(selectionToFlatIds({
      kind: 'relationship', domainId: 'd1', relationshipId: 'r1'
    }).selectedRelationshipId).toBe('r1');
    expect(selectionToFlatIds({
      kind: 'note', noteId: 'n1', domainId: 'd1'
    }).selectedNoteId).toBe('n1');
  });

  it('normalizes exclusive sidebar maps with legacy aliases', () => {
    expect.hasAssertions();
    expect(normalizeMultiSidebarExpanded(null, null)).toStrictEqual({
      model: false, history: false, validate: false, export: false, import: false
    });
    expect(normalizeMultiSidebarExpanded({ quality: true, share: true }, 'share').export)
      .toBe(true);
    expect(normalizeMultiSidebarExpanded({ diff: '1', import: 1 }, 'import').import)
      .toBe(true);
    expect(normalizeMultiSidebarExpanded(
      { inspector: true, entities: true, selection: true },
      'bogus'
    ).model).toBe(true);
    expect(normalizeMultiSidebarExpanded({ history: true, validate: true }, 'validate'))
      .toMatchObject({ history: false, validate: true });
  });

  it('attaches from/to domain ids when normalizing relationships', () => {
    expect.hasAssertions();
    const index = new Map([['e1', 'd1'], ['e3', 'd2']]);
    expect(normalizeRelationship({
      id: 'r1', fromEntityId: 'e1', toEntityId: 'e3'
    }, index)).toMatchObject({
      fromDomainId: 'd1',
      toDomainId: 'd2',
      name: 'e1 -> e3'
    });
    expect(normalizeRelationship({
      id: 'r2',
      fromEntityId: 'e1',
      toEntityId: 'e3',
      fromDomainId: '  ',
      toDomainId: 'kept',
      name: 'Link'
    }, null)).toMatchObject({
      fromDomainId: null,
      toDomainId: 'kept',
      name: 'Link'
    });
  });
});
