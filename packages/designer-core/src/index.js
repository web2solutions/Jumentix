/**
 * `@jumentix/designer-core` — the framework-free Service Management designer
 * core (JUM-493).
 *
 * This package is the canonical home of the designer core: the modules below
 * were moved here from `apps/service-management/src/` so the dependency
 * direction runs package → consumer, never package → app (the workspace
 * boundary the architecture gate enforces). The zero-build SPA consumes them
 * through the `@jumentix/designer-core/…` bare specifiers, which the import
 * map in `apps/service-management/index.html` resolves to the vendored tree
 * (`vendor/designer-core/`, synced from this package's `src/` by
 * `apps/service-management/scripts/sync-service-management-designer-core.js`), while Bun, Jest and tsc
 * resolve the same specifiers to this `src/` through the repo's path mapping.
 *
 * What is in (per the issue): the domain model and its normalizers, the
 * validation/model-check engine, the exporters (JSON, Markdown, JSON Schema,
 * AsyncAPI, boilerplate bundle, package, OAS), the importers (domain package,
 * state file, OAS file), the schema-diff/merge-preview engine, the hexagonal
 * codegen, and `IDesignerStore` as a *type/contract only*.
 *
 * What is out: every DOM module (`script.js`, `src/ui/`, `src/pwa/`), the
 * status surfaces, the sync clients (`state/designerSync.js`,
 * `state/catalogSyncClient.js`) and the storage adapters
 * (`store/CanaDesignerStore.js`, `store/canaMigration.js`,
 * `store/designerStoreFactory.js`) — those stay in the app. Nothing below
 * imports Cana, the DOM, `window`, `document` or `localStorage` —
 * `test/dom-free.test.ts` proves it on the built artifact, and
 * `test/consumer-smoke.test.ts` loads and runs the artifact in a non-DOM
 * process.
 */

// The domain model: queries, matrices, RBAC contract and the sample model.
export * from './model/modelQueries.js';
export * from './model/propertyKeys.js';
export * from './model/rbacContract.js';
export * from './model/sampleModel.js';
export * from './model/architecture.js';
export * from './model/deployCapabilityMatrix.js';
export * from './model/interfaceFrameworkMatrix.js';

// The model normalizers and the designer state shape.
export * from './state/designerState.js';

// The validation / model-check engine.
export * from './validation/modelValidation.js';
export * from './validation/asyncApi30Validation.js';
export * from './validation/deployTargetValidation.js';
export * from './validation/deployTargetLifecycleValidation.js';
export * from './validation/interfaceAdapterValidation.js';
export * from './validation/serviceConfigurationValidation.js';
export * from './validation/architectureValidation.js';

// The exporters: JSON, Markdown, JSON Schema, AsyncAPI, boilerplate bundle,
// domain package and OAS.
export * from './exporters/designerExporters.js';
export * from './exporters/asyncApiExporters.js';

// The importers: domain package, state file and OAS file.
export * from './importers/designerImporters.js';

// The schema-diff / domain-package versioning and merge-preview engine.
export * from './packages/packageVersioning.js';

// The hexagonal boilerplate codegen behind the bundle exporter.
export * from './codegen/hexagonalCodegen.js';

// The storage port as a contract only — no adapter ships in this package.
export * from './store/IDesignerStore.js';
