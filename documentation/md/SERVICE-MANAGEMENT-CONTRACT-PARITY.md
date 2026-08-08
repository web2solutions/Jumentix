# Service Management Contract Parity Guarantees

This is the E4 document of the Service Management E1–E8 documentation chain
([JUM-479](https://linear.app/jumentix/issue/JUM-479/docs-e4-documentation-contract-parity-guarantees)).
It documents what the designer's contract exports **guarantee** — as the code
behaves today, after the contract-parity lane
([JUM-474](https://linear.app/jumentix/issue/JUM-474/feature-oas-31-export-compliant-with-req-036-and-route-resolution),
[JUM-475](https://linear.app/jumentix/issue/JUM-475/feature-asyncapi-and-proto-exports-targeting-canonical-specasyncapi),
[JUM-476](https://linear.app/jumentix/issue/JUM-476/feature-codegen-preview-and-boilerplate-bundle-emit-hexagonal-layout),
[JUM-477](https://linear.app/jumentix/issue/JUM-477/feature-rbac-editor-aligned-to-tenant-rbac-authorization-contract),
[JUM-478](https://linear.app/jumentix/issue/JUM-478/feature-lossless-round-trip-import-of-spec100yml-with-full-meta))
and its verification machinery
([JUM-470](https://linear.app/jumentix/issue/JUM-470),
[JUM-471](https://linear.app/jumentix/issue/JUM-471/test-bun-unit-suite-exportersimporters-round-trip))
landed.

The guarantee is a promise to the boilerplate, not a feature list: **an
artifact exported from the designer can be consumed by the boilerplate
without hand-editing.** Each guarantee below names the check that proves it,
so a reader can verify rather than trust, and a maintainer who breaks one
fails a suite — not a review opinion.

The export surface itself (eight exporters, their formats and the export
quality gate) is pinned by
[Requirement 126, Contract 3](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
— this document links to it rather than duplicating it. Usage-level walkthroughs
live in
[Domain Designer Features and Usage](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
(sections 10.1–10.2).

## Guarantee 1 — the OAS 3.1 export is boilerplate-consumable (JUM-474)

Builder: `buildOasDocument` in
[`apps/service-management/src/exporters/designerExporters.js`](../../apps/service-management/src/exporters/designerExporters.js).

**The document declares `openapi: '3.1.0'` — 3.1, not 3.0 — because that is
the version the boilerplate consumes.** The canonical
[`spec/1.0.0.yml`](../../spec/1.0.0.yml) declares `3.1.0`, and the entity
model is legislated OpenAPI 3.1 end to end by
[Requirement 026](../../.agents/requirements/software/026-openapi31-data-entity-model-compliance.md)
(3.1 is the JSON Schema 2020-12-aligned line; the designer's JSON Schema
export targets the same draft). An export that matched the canonical
version's syntax but not its version would be a contract the consumer has to
translate — so the export emits exactly the dialect the boilerplate's gates
already validate.

The exported document is guaranteed to satisfy
[Requirement 036](../../.agents/requirements/software/036-openapi-port-objects-contracts.md),
the port-object discipline enforced on the canonical spec by
[`ci-cd/check-oas-route-resolution.js`](../../ci-cd/check-oas-route-resolution.js):

- **Canonical verb `operationId`s.** Every operation carries an `operationId`
  on the canonical verb scheme (`getAll*` / `create*` / `get*ById` /
  `update*` / `delete*`), qualified by the schema name so ids stay unique
  across domains (`getAllBilling_Invoice`).
- **The `$ref` discipline.** Request bodies reference
  `RequestCreate<Schema>` / `RequestUpdate<Schema>` port input objects via
  `$ref`; every 2xx response references the entity schema, its
  `<Schema>ArrayOf` wrapper, or the shared `ResourceDeleteResponse` — never an
  inline schema. Every referenced schema carries a non-empty `description`.
- **Canonical error codes.** Error responses use the
  [ERROR-CONTRACTS-AND-RESPONSES](./ERROR-CONTRACTS-AND-RESPONSES.md) status
  set (400/401/403/404/409) with its canonical descriptions.
- **Port wrappers are marked, not hidden.** Derived port input/output
  wrappers carry `'x-port-object': true`, which is what lets the OAS importer
  skip them (see Guarantee 4).

**Proven by:**
[`designerOasCompliance.test.ts`](../../apps/backend-template/test/unit/service-management/designerOasCompliance.test.ts),
which imports `validatePortObjectContracts` and `resolveSchemaByRef` **from
the real checker** (not a copy) and applies them to a document exported from
a UI-style model — the export cannot drift from the gate without failing the
suite. The name-collision half of the guarantee (two names that tokenize to
the same schema/route, e.g. `Foo Bar` vs `Foo-Bar`, are export-gate-blocking
errors rather than silent overwrites) lives in
[`modelValidation.js`](../../apps/service-management/src/validation/modelValidation.js)
and is pinned by
[`modelValidation.test.ts`](../../apps/backend-template/test/unit/service-management/modelValidation.test.ts).

## Guarantee 2 — AsyncAPI 3.0 per transport and a canonical proto (JUM-475)

Builders:
[`apps/service-management/src/exporters/asyncApiExporters.js`](../../apps/service-management/src/exporters/asyncApiExporters.js).

- **One file per transport, canonical naming.** The export emits
  `<version>.websocket.yml` and `<version>.grpc.yml`, matching the
  [`spec/asyncapi/`](../../spec/asyncapi/1.0.0.websocket.yml) directory
  one-for-one — never a single combined document, never the 2.x
  publish/subscribe shape. Under 3.0, channels hold `messages` and the
  top-level `operations` map carries `action: send|receive` (`response`
  contracts are received; every other type is sent) plus channel/message
  `$ref`s.
- **The same `$ref` payload discipline as OAS.** Message payloads live once
  under `components.schemas` and messages reference them — identical payloads
  share one schema entry instead of being inlined per message.
- **Every exported document validates against**
  `validateAsyncApi30Document`
  ([`asyncApi30Validation.js`](../../apps/service-management/src/validation/asyncApi30Validation.js)),
  the in-repo structural validator for the 3.0 shape (the repository does not
  depend on `@asyncapi/parser`). The canonical `spec/asyncapi/` files pass
  the same rules — drop-in shape parity between what the designer emits and
  what the boilerplate ships.
- **The gRPC proto export reproduces the canonical envelope.** proto3,
  package `realtime`, service `AsyncApiGateway`, envelope messages
  `AsyncApiRequest`/`AsyncApiResponse`, one rpc/message pair per designer
  message contract. For a contract-less model the emitted proto is
  **byte-identical** to the checked-in
  [`spec/asyncapi/async-api.proto`](../../spec/asyncapi/async-api.proto).

**Proven by:**
[`designerAsyncApiExport.test.ts`](../../apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts)
— including the byte-identity assertion and the test that runs the validator
over the canonical files themselves, so the canonical documents and the
export drift together or fail together.

## Guarantee 3 — the codegen bundle is deliverable code (JUM-476)

Builder:
[`apps/service-management/src/codegen/hexagonalCodegen.js`](../../apps/service-management/src/codegen/hexagonalCodegen.js),
consumed by both the boilerplate-bundle exporter
(`buildBoilerplateBundleDocument`, artifact `kind: 'boilerplate-bundle'`,
`version: '2.0.0'`) and the designer's Code Preview pane — same builder, so
preview and bundle cannot drift apart.

- **The layout is hexagonal and mirrors the migrated Users module**
  (`src/modules/<Domain>/` with `domain/{Entity,Model,security}`,
  `application/{ports,use-cases}`, `adapters/in/http/controllers`,
  `adapters/out/persistence`, `composition/`, and `events/contracts/` only
  when message contracts exist — see
  [HEXAGONAL-FEATURE-DRIVEN-MIGRATION](./HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md)).
- **Contract shapes are consumed, never re-derived.** Field types come from
  the Guarantee-1 OAS component schemas, HTTP routes from its paths and
  `operationId`s, event channels from the Guarantee-2 AsyncAPI channels. A
  contract change regenerates the code; the code never forks the contract.
- **The output passes the repository's own architecture checks.** Every
  generated controller passes `validateControllerFile` from
  [`ci-cd/check-hexagonal-boundaries.js`](../../ci-cd/check-hexagonal-boundaries.js),
  and the generated import graph only points inward (domain ← application ←
  adapters ← composition).
- **The output compiles.** The emitted file set compiles under
  `tsc --strict` — the suite writes the bundle to a temp directory and runs
  the real compiler over it.

**What the developer still writes.** The bundle is a runnable skeleton, not a
service: the persistence adapter is an in-memory `Map` mirror of
`UserDataRepository.ts` that you swap for the real store client, the
composition root must be wired into the service bootstrap, and any business
rule beyond the canonical CRUD verbs is yours. The guarantee covers the
boundary — layout, contracts, compilation, architecture checks — not the
application logic.

**Proven by:**
[`hexagonalCodegen.test.ts`](../../apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts).

## Guarantee 4 — round-trip fidelity, with the honest boundaries (JUM-471, JUM-478)

Suite:
[`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts).
The property under test is the crossing itself — export → import → compare —
so an exporter-drops-field + importer-ignores-field cancellation cannot hide
behind fixed expected outputs.

### Symmetric crossings (lossless, deep-equal asserted)

- **JSON** (`buildJsonExportDocument` → `buildStateFromSuiteExport` over
  `normalizeStatePayload`): the versioned full-suite document (JUM-547) —
  `domains`, `relationships`, `view`, `interfaces`, `serviceConfiguration`
  and `deployments` round-trip deep-equal, and the export is idempotent. The
  boundary is documented and asserted: selections and `idCounter` are not
  part of the document and are recomputed on import, and `runtimeEnvironment`
  crosses as the environment *selection* only (see the JUM-547 section
  below). Pre-JUM-547 domain-only documents (`{ domains, relationships,
  view }`, no `kind`/`version`) import cleanly with the missing sections
  defaulted; a document with an unknown top-level section, a newer major
  `version`, or a `kind` other than `service-management-suite` fails clearly
  instead of half-importing.
- **Domain package** (`buildDomainPackageDocument` → `buildDomainFromPackage`):
  a package round-trips deep-equal into an empty model; re-import suffixes
  the domain name (`Billing_2`, `Billing_3`, …) instead of colliding.

### The OAS crossing: fixed point, empty loss list

OAS is narrower than the internal model, so the OAS crossing was the lossy
one. JUM-478 drove the model-level loss list **from 21 diff paths to zero**,
and the suite asserts the exact empty list — a field silently joining (or
rejoining) it fails the suite:

- **Export → import → export reaches a fixed point**; the first-crossing
  document diff is exactly `[]` (asserted with `toStrictEqual`, not
  eyeballed).
- What OAS cannot express natively crosses as agreed `x-` extensions the
  importer normalizes back into `entity.meta`: `x-aggregate-root`,
  `x-invariants`, `x-rbac` (emitted only when the policy diverges from the
  designer default — an absent `x-rbac` normalizes back to exactly that
  default), `x-fieldless: true` (an empty field set survives instead of
  gaining the importer's default `id`/`createdAt`/`updatedAt`), and per-field
  `x-field-flags: { pk, fk, unique }` (emitted only when the flags diverge
  from the importer's name heuristic: `id` → PK/unique, `*Id` → FK).
  Message contracts and composition (`oneOf`/`allOf`/`anyOf`, `discriminator`,
  `x-external-refs`) cross the same way.
- **Relationships cross as top-level `x-relations` rows keyed by schema
  name** (`{ name, fromSchema, toSchema, fromCardinality, toCardinality }`) —
  never by model id, because the importer recomputes ids and ids in the
  document would break the fixed point. Rows whose endpoints did not import
  are dropped, the same rule `normalizeStatePayload` applies to dangling
  model ids.
- **The port-object wrappers are skipped by design — and that is not a
  loss.** `RequestCreate*`/`RequestUpdate*`/`*ArrayOf`/`ResourceDeleteResponse`
  are derived artifacts, not model state; re-importing them would fabricate
  phantom entities. Designer-exported documents mark them with
  `'x-port-object': true`.

### The boundaries that remain (named, asserted, not swept away)

For **designer-exported documents** the model-level crossing still does not
carry, by design:

- **Domain bounded-context blocks** (`domain.context`) and **canvas layout**
  (positions, colors) — they have no extension carriage; import recomputes
  them. Domain and entity **names** survive.
- **The typed-format normalization**: typed fields (`uuid`/`date`/`datetime`)
  come back carrying the canonical format the exporter derived from their
  type. The suite asserts this as the transformation
  `applyDocumentedOasFormatNormalization`, so it is part of the contract, not
  an accident.
- **View state** (zoom, filters, the export-gate toggle) is JSON-export
  content, not OAS content — the OAS importer never restored it.

For **foreign documents** — OAS files the designer did not emit, such as the
canonical [`spec/1.0.0.yml`](../../spec/1.0.0.yml) — the importer recognizes
port objects by convention (the same naming/description rules: `Request*`,
`*ArrayOf`, `ResourceDeleteResponse`, "Port input/output object" descriptions
that are not `<Name> resource` entity contracts, and non-object schemas), and
the named remaining losses are:

- the **`example` / `default` / `minItems` / `maxItems` facets** — the
  designer field model has no slot for them;
- **array item `$ref` linkages** — value-object references flatten to the
  `itemsType` vocabulary;
- **legacy (non-canonical) `operationId`s** — import keeps no operationIds,
  so re-export regenerates them on the canonical verb scheme.

The canonical import itself is pinned: `spec/1.0.0.yml` (OpenAPI 3.1.0, 33
operationIds) imports as one `Imported` domain with exactly the six contract
schemas (`Document`, `Email`, `Address`, `Phone`, `User`, `Organization`) —
no phantom port-object entities, no relationships — with full meta
normalization, and re-exports to a fixed point whose entity schemas keep the
source's properties and required sets and whose paths carry the five
canonical CRUD operations per schema.

### One-way exporters

Markdown, JSON Schema, AsyncAPI and the boilerplate bundle have no importer.
Their suites assert structural invariants instead of a crossing: every
domain/entity/field/relationship renders; one JSON Schema definition per
entity with `required ⊆ properties` and `additionalProperties: false`; one
AsyncAPI 3.0 operation per contract per transport with shared payload refs;
one bundle module per domain with the hexagonal file set.

## Where the gates enforce all of this

- **The export quality gate** (Requirement 126, Contract 3): with
  `view.exportBlockCritical` true (the default), every exporter refuses to
  run while
  [`collectModelIssues`](../../apps/service-management/src/validation/modelValidation.js)
  reports any `error`-severity issue — which includes the OAS name-collision
  rule and unenforceable RBAC roles (see below). The gate's DOM half is
  `canExportModel` in
  [`apps/service-management/script.js`](../../apps/service-management/script.js).
- **The unit suites are the enforcement.** All suites named above run under
  Bun through the mapped runner
  ([`ci-cd/run-unit-tests.js`](../../ci-cd/run-unit-tests.js), which refuses a
  run that discovers zero tests) inside `bun run test:unit` — a cell of every
  branch quality gate (`ci-cd/run-branch-quality-gate.js` selects it for
  direct pushes to `dev`, and the full matrix for pull requests into `dev`
  and `main`).
- **The canonical-spec gates stay green on the boilerplate side**:
  `bun run oas:check-routes` (Req 036 on `spec/`) and
  `bun run arch:check-boundaries` are cells of `ci:gate`, so a canonical
  contract the designer targets cannot silently stop being what the export
  was shaped against.

## RBAC alignment and the divergence it reconciled (JUM-477)

The per-entity RBAC editor is aligned to the
[Tenant and RBAC Authorization Contract](./TENANT-RBAC-AUTHORIZATION-CONTRACT.md)
through
[`src/model/rbacContract.js`](../../apps/service-management/src/model/rbacContract.js),
a designer-side mirror of the Users domain implementation (`Rbac.ts`,
`TenantAuthorizationPolicy.ts`). The reconciliation found a real divergence,
recorded here rather than quietly fixed:

- **The designer persisted `tenantScoped` as a free per-rule flag; the
  runtime has no such knob.** Tenant scoping in the runtime is *derived* from
  the role set (`shouldRequireOrganization`: normalized `admin`/`user` roles
  constrain the principal to its organization; `superadmin` and legacy direct
  scopes keep a global boundary). A stored `tenantScoped` value that
  contradicted the roles was a configuration the boilerplate would silently
  not honour. The editor now derives `tenantScoped` from the selected roles
  (the checkbox is read-only and previews the derived value), and stored
  policies are repaired to the derived value on load — a compatible extension
  under Requirement 126 Contract 2, with the stored shape unchanged.
- **The principal vocabulary is closed.** Only the normalized tenant roles
  (`superadmin`, `admin`, `user`) and the legacy direct scopes are
  enforceable; anything else is rejected at edit time and reported as an
  `error` by model validation, so the export gate blocks it instead of
  exporting a policy the runtime would drop.

**Proven by:**
[`rbacContract.test.ts`](../../apps/backend-template/test/unit/service-management/rbacContract.test.ts),
which pins the mirror against `Rbac.ts` itself — if the domain vocabulary
drifts, the suite fails. This is also why `x-rbac` round-trips losslessly
(Guarantee 4): the exported policy is the normalized, enforceable one, and
the importer rebuilds it against the same contract.

## Full-suite export and the `runtimeEnvironment` decision (JUM-547, landed)

Export and import now carry **all four tabs**, not just the domain model. The
JSON export (`domain-designer.json`) is the versioned full-suite document:
`{ kind: "service-management-suite", version: "2.0.0", domains, relationships,
interfaces, serviceConfiguration, runtimeEnvironment, deployments, view }` —
the same sections the pinned `service-management.v1` document persists in
Cana (Requirement 126, Contract 2), minus the session selections and
`idCounter`. A model designed across all four tabs exports and re-imports
with every tab intact; a bundle exported before this change (the domain-only
shape, no `kind`/`version`) imports cleanly with the missing sections
defaulted, and a bundle with an unknown section or a newer major version
fails clearly rather than half-succeeding.

The recorded decision is `runtimeEnvironment`'s treatment
([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration),
Requirement 126 Contract 3): it mirrors real `.env` contents, so an export
bundle containing the values **would be a file that can carry configuration
off the machine**. Of the three candidate positions — export the selection
only; export values restricted to the editable tier; omit the section
entirely — the landed stance is the first: **the bundle carries the
environment selection (`environment`, `fileName`) but never `values`**, and
import restores the selection while preserving the local machine's values.
The runtime environment is a property of where the designer is running; the
selection is design metadata worth sharing. Since no values cross, **no
secret can leave in a bundle** — the guarantee the third position was
preferred for, kept without losing the selection. The suite proves it by
asserting the wire document contains no value string.

**Proven by:**
[`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts)
(full-suite deep-equal, values-never-cross, backward/forward compatibility)
and
[`designerExporters.test.ts`](../../apps/backend-template/test/unit/service-management/designerExporters.test.ts)
(document shape).

## References

- OAS exporter/importer: [`designerExporters.js`](../../apps/service-management/src/exporters/designerExporters.js), [`designerImporters.js`](../../apps/service-management/src/importers/designerImporters.js)
- AsyncAPI/proto exporters: [`asyncApiExporters.js`](../../apps/service-management/src/exporters/asyncApiExporters.js); validator: [`asyncApi30Validation.js`](../../apps/service-management/src/validation/asyncApi30Validation.js)
- Codegen: [`hexagonalCodegen.js`](../../apps/service-management/src/codegen/hexagonalCodegen.js)
- Model validation / export gate: [`modelValidation.js`](../../apps/service-management/src/validation/modelValidation.js), [`script.js`](../../apps/service-management/script.js)
- RBAC mirror: [`rbacContract.js`](../../apps/service-management/src/model/rbacContract.js); contract: [Tenant and RBAC Authorization Contract](./TENANT-RBAC-AUTHORIZATION-CONTRACT.md)
- Suites: [`designerRoundTrip.test.ts`](../../apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts), [`designerOasCompliance.test.ts`](../../apps/backend-template/test/unit/service-management/designerOasCompliance.test.ts), [`designerAsyncApiExport.test.ts`](../../apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts), [`hexagonalCodegen.test.ts`](../../apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts), [`rbacContract.test.ts`](../../apps/backend-template/test/unit/service-management/rbacContract.test.ts), [`modelValidation.test.ts`](../../apps/backend-template/test/unit/service-management/modelValidation.test.ts)
- Gates: [`check-oas-route-resolution.js`](../../ci-cd/check-oas-route-resolution.js), [`check-hexagonal-boundaries.js`](../../ci-cd/check-hexagonal-boundaries.js), [`run-unit-tests.js`](../../ci-cd/run-unit-tests.js)
- Canonical targets: [`spec/1.0.0.yml`](../../spec/1.0.0.yml), [`spec/asyncapi/1.0.0.websocket.yml`](../../spec/asyncapi/1.0.0.websocket.yml), [`spec/asyncapi/1.0.0.grpc.yml`](../../spec/asyncapi/1.0.0.grpc.yml), [`spec/asyncapi/async-api.proto`](../../spec/asyncapi/async-api.proto)
- Requirements: [036](../../.agents/requirements/software/036-openapi-port-objects-contracts.md) (port objects), [026](../../.agents/requirements/software/026-openapi31-data-entity-model-compliance.md) (OAS 3.1 entity compliance), [126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md) (ownership and public contracts, Contracts 2–3)
- Sibling E-chain documents: [Service Management Application](./SERVICE-MANAGEMENT-APPLICATION.md), [Service Management Module Architecture and IDesignerStore Port Contract](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md), [Domain Designer Features and Usage](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
- Linear: [JUM-474](https://linear.app/jumentix/issue/JUM-474/feature-oas-31-export-compliant-with-req-036-and-route-resolution), [JUM-475](https://linear.app/jumentix/issue/JUM-475/feature-asyncapi-and-proto-exports-targeting-canonical-specasyncapi), [JUM-476](https://linear.app/jumentix/issue/JUM-476/feature-codegen-preview-and-boilerplate-bundle-emit-hexagonal-layout), [JUM-477](https://linear.app/jumentix/issue/JUM-477/feature-rbac-editor-aligned-to-tenant-rbac-authorization-contract), [JUM-478](https://linear.app/jumentix/issue/JUM-478/feature-lossless-round-trip-import-of-spec100yml-with-full-meta), [JUM-470](https://linear.app/jumentix/issue/JUM-470), [JUM-471](https://linear.app/jumentix/issue/JUM-471/test-bun-unit-suite-exportersimporters-round-trip), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration)
