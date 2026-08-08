/**
 * sampleModel — the first-run sample domain model (JUM-548).
 *
 * A first-time user used to open the designer on a silently pre-populated
 * toy template; the first-run experience is now an explicit, one-action
 * sample load from the guided empty states. This module is the content of
 * that sample: a small but realistic identity domain — the same Users and
 * Organization resources the canonical `spec/1.0.0.yml` declares and the
 * boilerplate implements (JUM-478's round-trip reference), extended with an
 * e-mail/phone value-object pair and a composition entity so the sample
 * exercises the surfaces an empty canvas hides: relationships, per-entity
 * RBAC (including a non-default rule whose tenant scoping is visibly derived
 * from the roles), a message contract, invariants and OAS `oneOf` +
 * discriminator composition.
 *
 * The sample is MARKED, not hidden state: every domain/entity/relationship/
 * contract id carries the `sample-` prefix (`SAMPLE_ID_PREFIX`), which
 * crosses the JSON export/import boundary verbatim (ids are kept when free),
 * and the UI renders a "sample" badge on sample domains. Deleting the sample
 * is ordinary deletion — domain or entity delete — with no special path.
 *
 * The returned payload is the raw `service-management.v1` slice shape: the
 * caller runs it through `normalizeStatePayload` exactly as a JSON import
 * would, so loading the sample IS the import crossing — the sample doubles
 * as a live demonstration (and as the JUM-471 fixture) that export and
 * re-import work. Model validation reports zero error-severity issues on
 * the normalized sample, so the export quality gate passes on it; a sample
 * that cannot export would teach the wrong lesson.
 *
 * Everything here is pure data and predicates — no `document`, no `window`
 * — so the module imports and runs under Bun/Node with no DOM shim, like the
 * other `src/model/` modules. The module map's dependency direction (state →
 * model, never model → state) is why the palette color and the view defaults
 * below are literals rather than imports from `src/state/designerState.js`.
 */

/** Id prefix marking every artifact the sample loader creates. */
export const SAMPLE_ID_PREFIX = 'sample-';

/** Whether a domain was created by the sample loader (id-marker predicate). */
export function isSampleDomain(domain) {
  return String(domain?.id || '').startsWith(SAMPLE_ID_PREFIX);
}

/** Whether an entity was created by the sample loader (id-marker predicate). */
export function isSampleEntity(entity) {
  return String(entity?.id || '').startsWith(SAMPLE_ID_PREFIX);
}

/** Whether a relationship was created by the sample loader (id-marker predicate). */
export function isSampleRelationship(relationship) {
  return String(relationship?.id || '').startsWith(SAMPLE_ID_PREFIX);
}

/**
 * Build the raw sample model payload (`{ domains, relationships }`), ready
 * for `normalizeStatePayload`. View state is intentionally absent: the
 * normaliser restores the default view, which is the right reset for a
 * first-run load.
 *
 * The Organization RBAC policy is authored non-default on purpose: `create`
 * is `superadmin`-only (organizations are platform-level resources, so the
 * derived tenant scoping is global) while reads stay tenant-scoped — the
 * inspector then shows both derivation outcomes on real data.
 */
export function buildSampleModelPayload() {
  const auditFields = [
    { name: 'createdAt', type: 'datetime', required: true },
    { name: 'updatedAt', type: 'datetime', required: true }
  ];
  return {
    domains: [
      {
        id: 'sample-domain-users',
        name: 'Users',
        color: '#60a5fa',
        x: 80,
        y: 80,
        context: {
          ubiquitousLanguage: 'identity, organization, tenant, contact point',
          ownerTeam: 'platform'
        },
        entities: [
          {
            id: 'sample-entity-user',
            name: 'User',
            x: 14,
            y: 14,
            fields: [
              { name: 'id', type: 'uuid', required: true, pk: true, unique: true },
              {
                name: 'organizationId',
                type: 'uuid',
                required: true,
                fk: true,
                description: 'Organization id for tenant users (admin/user)'
              },
              {
                name: 'username',
                type: 'string',
                required: true,
                unique: true,
                minLength: 1,
                description: 'Username to access the system'
              },
              { name: 'firstName', type: 'string', required: true, minLength: 1 },
              { name: 'lastName', type: 'string', nullable: true },
              {
                name: 'password',
                type: 'string',
                required: true,
                format: 'password',
                minLength: 8
              },
              ...auditFields
            ],
            meta: {
              aggregateRoot: true,
              invariants: [
                'username must be unique within an organization',
                'a user keeps at least one contact point'
              ],
              contracts: [
                {
                  id: 'sample-contract-user-registered',
                  name: 'UserRegistered',
                  type: 'event',
                  channel: 'users/user-registered',
                  version: '1.0.0',
                  payloadSchema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      username: { type: 'string' }
                    },
                    required: ['id', 'username']
                  }
                }
              ]
            }
          },
          {
            id: 'sample-entity-organization',
            name: 'Organization',
            x: 240,
            y: 14,
            fields: [
              { name: 'id', type: 'uuid', required: true, pk: true, unique: true },
              { name: 'name', type: 'string', required: true, minLength: 1 },
              ...auditFields
            ],
            meta: {
              aggregateRoot: true,
              invariants: ['organization name is not empty'],
              rbac: {
                list: { roles: ['superadmin', 'admin', 'user'] },
                getById: { roles: ['superadmin', 'admin', 'user'] },
                create: { roles: ['superadmin'] },
                update: { roles: ['superadmin', 'admin'] },
                delete: { roles: ['superadmin'] }
              }
            }
          },
          {
            id: 'sample-entity-email',
            name: 'Email',
            x: 14,
            y: 134,
            fields: [
              { name: 'id', type: 'uuid', required: true, pk: true, unique: true },
              { name: 'address', type: 'string', required: true, format: 'email' },
              { name: 'verified', type: 'boolean', required: true },
              { name: 'userId', type: 'uuid', required: true, fk: true }
            ]
          },
          {
            id: 'sample-entity-phone',
            name: 'Phone',
            x: 240,
            y: 134,
            fields: [
              { name: 'id', type: 'uuid', required: true, pk: true, unique: true },
              { name: 'number', type: 'string', required: true, pattern: '^\\+[1-9]\\d{7,14}$' },
              { name: 'primary', type: 'boolean', required: true },
              { name: 'userId', type: 'uuid', required: true, fk: true }
            ]
          },
          {
            id: 'sample-entity-contact-point',
            name: 'ContactPoint',
            x: 127,
            y: 254,
            fields: [
              { name: 'id', type: 'uuid', required: true, pk: true, unique: true },
              {
                name: 'kind',
                type: 'string',
                required: true,
                enumValues: ['email', 'phone'],
                description: 'Discriminator for the contact-point variants'
              }
            ],
            meta: {
              oasComposition: {
                mode: 'oneOf',
                refs: ['Users_Email', 'Users_Phone'],
                discriminator: 'kind'
              }
            }
          }
        ]
      }
    ],
    relationships: [
      {
        id: 'sample-rel-user-organization',
        fromEntityId: 'sample-entity-user',
        toEntityId: 'sample-entity-organization',
        name: 'User belongs to Organization',
        fromCardinality: 'N',
        toCardinality: '1'
      },
      {
        id: 'sample-rel-email-user',
        fromEntityId: 'sample-entity-email',
        toEntityId: 'sample-entity-user',
        name: 'Email belongs to User',
        fromCardinality: 'N',
        toCardinality: '1'
      },
      {
        id: 'sample-rel-phone-user',
        fromEntityId: 'sample-entity-phone',
        toEntityId: 'sample-entity-user',
        name: 'Phone belongs to User',
        fromCardinality: 'N',
        toCardinality: '1'
      }
    ]
  };
}
