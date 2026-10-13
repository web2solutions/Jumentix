/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/**
 * Domain ⊃ Entity schema ownership + selection path + exclusive sidebar tab migrate.
 */
const designerState = require('@jumentix/designer-core/state/designerState.js');
const modelValidation = require('@jumentix/designer-core/validation/modelValidation.js');

describe('domain entity hierarchy schema', () => {
  it('stamps entity.domainId and kind on normalize', () => {
    expect.hasAssertions();
    const domain = designerState.normalizeDomainInput({
      id: 'd1',
      name: 'Billing',
      entities: [{
        id: 'e1',
        name: 'Invoice',
        fields: [{
          name: 'id', type: 'uuid', pk: true, required: true
        }]
      }]
    }, 0);
    expect(domain.entities[0].domainId).toBe('d1');
    expect(domain.entities[0].kind).toBe('data');
    expect(designerState.normalizeEntityInput({ name: 'X' }, 0, 'parent-1').domainId)
      .toBe('parent-1');
  });

  it('migrates flat selection into hierarchical selection path', () => {
    expect.hasAssertions();
    const parsed = designerState.normalizeStatePayload({
      domains: [{
        id: 'd1',
        name: 'Users',
        entities: [{
          id: 'e1',
          name: 'Account',
          fields: [{
            name: 'id', type: 'uuid', pk: true, required: true
          }]
        }]
      }],
      relationships: [],
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      selectedFieldName: 'id'
    });
    expect(parsed.selection).toStrictEqual({
      kind: 'field',
      domainId: 'd1',
      entityId: 'e1',
      fieldName: 'id',
      relationshipId: null,
      noteId: null
    });
    expect(designerState.selectionToFlatIds(parsed.selection)).toMatchObject({
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      selectedFieldName: 'id',
      selectedRelationshipId: null,
      selectedNoteId: null
    });
    expect(designerState.MODEL_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(designerState.emptySelection()).toMatchObject({ kind: 'none' });
    expect(designerState.normalizeSelection({ kind: 'bogus' })).toMatchObject({ kind: 'none' });
  });

  it('flags domainId mismatch as a model issue', () => {
    expect.hasAssertions();
    const issues = modelValidation.collectModelIssues({
      domains: [{
        id: 'd1',
        name: 'Billing',
        entities: [{
          id: 'e1',
          name: 'Invoice',
          domainId: 'other',
          fields: [{
            name: 'id', type: 'uuid', pk: true, required: true
          }]
        }]
      }],
      relationships: []
    });
    expect(issues.some((issue: { message: string }) => issue.message.includes('domainId mismatch')))
      .toBe(true);
  });
});
