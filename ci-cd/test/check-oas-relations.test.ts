/* eslint-disable @typescript-eslint/no-var-requires */
const { collectRelationErrors } = require('../check-oas-relations');

const passingDocument = {
  components: {
    schemas: {
      User: {
        'x-primary-key': 'id',
        properties: {
          id: { type: 'string' },
          organization: {
            'x-relation': {
              entity: 'Organization', match: 'id', kind: 'belongsTo', display: 'name'
            }
          }
        }
      },
      Organization: {
        'x-primary-key': 'id',
        properties: {
          id: { type: 'string' },
          users: {
            'x-relation': {
              entity: 'User', match: 'id', kind: 'hasMany', display: 'username'
            }
          }
        }
      }
    }
  }
};

const passingSources = {
  User: '@belongsTo(\'Organization\')\n  public get organization(): string { return ""; }',
  Organization: '@hasMany(\'User\')\n  public get users(): string[] { return []; }'
};

describe('check-oas-relations', () => {
  it('passes when OAS and model relations agree', () => {
    expect.hasAssertions();
    expect(collectRelationErrors({
      document: passingDocument,
      sources: passingSources
    })).toStrictEqual([]);
  });

  it('fails when an entity schema lacks x-primary-key', () => {
    expect.hasAssertions();
    const document: any = structuredClone(passingDocument);
    delete document.components.schemas.User['x-primary-key'];
    expect(collectRelationErrors({ document, sources: passingSources }).join('\n'))
      .toContain('User: missing x-primary-key, expected id');
  });

  it('fails when x-primary-key names a missing property', () => {
    expect.hasAssertions();
    const document = structuredClone(passingDocument);
    document.components.schemas.User['x-primary-key'] = 'pk';
    expect(collectRelationErrors({ document, sources: passingSources }).join('\n'))
      .toMatch(/User: x-primary-key is "pk"/);
  });

  it('fails when a model relation has no x-relation', () => {
    expect.hasAssertions();
    const document: any = structuredClone(passingDocument);
    delete document.components.schemas.User.properties.organization;
    expect(collectRelationErrors({ document, sources: passingSources }).join('\n'))
      .toContain('User.organization: model relation has no x-relation');
  });

  it('fails when an x-relation has no model decorator', () => {
    expect.hasAssertions();
    const sources = { ...passingSources, User: 'export class User {}' };
    expect(collectRelationErrors({ document: passingDocument, sources }).join('\n'))
      .toContain('User.organization: x-relation has no model decorator');
  });

  it('fails on wrong kind, entity or match', () => {
    expect.hasAssertions();
    const document: any = structuredClone(passingDocument);
    document.components.schemas.User.properties.organization['x-relation'] = {
      entity: 'Catalog', match: '_id', kind: 'hasMany', display: 'name'
    };
    const text = collectRelationErrors({ document, sources: passingSources }).join('\n');
    expect(text).toContain('x-relation.entity is "Catalog"');
    expect(text).toContain('x-relation.kind is "hasMany"');
    expect(text).toContain('x-relation.match is "_id"');
  });
});
