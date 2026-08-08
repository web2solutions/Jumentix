# Service Management Operations Console

This is the E5 document of the Service Management E1–E8 documentation chain
([JUM-482](https://linear.app/jumentix/issue/JUM-482/docs-e5-documentation-operations-console)).
It documents the **operations console** — the surfaces that turn the designer
from a modelling tool into something that describes and controls a running
service — exactly as the code behaves today, after the operations-console lane
([JUM-480](https://linear.app/jumentix/issue/JUM-480/feature-real-multi-environment-editing-and-pm2-ecosystem-preview),
[JUM-481](https://linear.app/jumentix/issue/JUM-481/feature-deploy-management-aligned-to-req-059-matrix-with-per-service),
[JUM-543](https://linear.app/jumentix/issue/JUM-543/fix-replace-blocking-alerts-with-non-blocking-status-surfaces-and),
[JUM-544](https://linear.app/jumentix/issue/JUM-544/fix-service-configuration-validation-port-conflicts-and-run-mode))
landed.

The console spans the **Service Configuration** tab (runtime profile, the PM2
ecosystem preview, and the runtime-environment editor), the **Deploy
Management** tab, and — for its lifecycle rules — the **Communication
Interface Designer**. These tabs carry rules a user cannot discover by
clicking: which run-mode × cloud-provider and service-type × deploy-target
combinations are valid and why an invalid one is rejected, which environment
file a save writes, and where the PM2 preview gets its process list. This
document makes those rules legible, names the check that proves each one, and
states the shared-source rule that keeps them from diverging.

Two deliberate boundaries:

- **The wire contracts are linked, not duplicated.** The runtime-env API and
  the PM2 ecosystem endpoint are pinned by
  [Requirement 126, Contracts 1 and 1b](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md),
  and the env-file/enum semantics by the E1 document,
  [Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md)
  ([JUM-464](https://linear.app/jumentix/issue/JUM-464/docs-e1-documentation-enpt-runtime-env-contract-and-fixed-paths)).
  This document references them; it does not restate them.
- **Persistence and boot behavior are out of scope.** The storage port and the
  storage migration belong to the E3 document,
  [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md);
  their user-facing promises — where the data lives, the loss modes and the
  export recourse — belong to the E6 document,
  [Service Management Cana Adoption, Migration and Offline Behaviour](./SERVICE-MANAGEMENT-CANA-ADOPTION.md).

## The shared capabilities matrix (JUM-544, JUM-481)

Both validating surfaces of the console — Service Configuration and Deploy
Management — read the Requirement 059 matrices from **one machine-readable
source**:
[`apps/service-management/src/model/deployCapabilityMatrix.js`](../../apps/service-management/src/model/deployCapabilityMatrix.js),
the reader of the two matrix documents
([JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX](./JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md)
and
[JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md)).

**The shared-source rule:** the matrix is transcribed exactly once, into this
module. A future contributor who extends or corrects the matrix edits **the
source module** — and the matrix documents in the same PR, as the module
header itself requires — never a second copy inside a tab's validation. The
console's two validators already demonstrate why:

- `collectServiceConfigurationIssues`
  ([`serviceConfigurationValidation.js`](../../apps/service-management/src/validation/serviceConfigurationValidation.js),
  JUM-544) consumes the **run-mode × cloud-provider** support map and the
  active-port map.
- `collectDeployTargetIssues`
  ([`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js),
  JUM-481) consumes the **service-type × deploy-target** support map, the
  per-service-type protocol map, the PM2-managed target set, and the driver
  vocabularies.

What the matrix encodes, and why an invalid combination is rejected:

- **Run mode × cloud provider.** `dedicated-server` runs on `self-hosted`;
  `virtual-machine` on `aws`/`google`/`azure`; `container` on `docker` or
  `self-hosted`; `functions` on `aws`/`vercel`/`cloudflare`. Anything outside
  these rows (e.g. `functions` + `self-hosted`, or a PM2-based run mode
  against `vercel`) has no deploy target in the Requirement 059 matrix — the
  design could not be built by any packaging row the factory ships, so it is
  rejected rather than recorded.
- **Service type × deploy target.** The PM2-managed rows (`dedicated-server`,
  `vm`, `ec2`) accept `restapi`, `websocket+restapi` and `grpc+restapi`
  services; the function rows (`lambda`, `vercel-functions`,
  `cloudflare-workers`) accept `functions` only. A `functions` service on a
  PM2 target — or a REST/realtime service on a function target — has no matrix
  row.
- **Protocol exposure.** A service type exposes only the protocols it actually
  binds: `restapi` serves HTTP, `websocket+restapi` adds WebSocket,
  `grpc+restapi` adds gRPC, and function APIs are HTTP entrypoints. Asking a
  `restapi` service to bind WebSocket is rejected because the runtime would
  never start such a listener.
- **PM2 profile applicability.** Only PM2-managed targets carry a
  `pm2Profile` (`dev`/`staging`/`production`); a profile on a provider-managed
  (serverless) target is a design the matrix cannot build, and a missing
  profile on a PM2-managed target leaves the ecosystem profile unchosen.
- **Active ports per service kind.** A `rest-api` service binds no realtime
  listener, so its unused WebSocket/gRPC ports are not validated — only the
  ports the selected service kind actually binds must be integers in 1–65535
  and mutually distinct.

Two vocabulary facts worth knowing before extending the matrix:

- **Two spellings coexist by design.** Service Configuration uses the
  Requirement 126 storage vocabulary (`serviceKind`: `rest-api`,
  `websocket-rest-api`, `grpc-rest-api`); Deploy Management uses the matrix's
  own spellings (`serviceType`: `restapi`, `websocket+restapi`,
  `grpc+restapi`, `functions`), which predate it. The module documents the
  divergence rather than papering over it.
- **The driver vocabularies mirror the runtime-env contract by reference.**
  `databaseDriver`/`keyValueDriver` are defined by the Requirement 059 matrix
  as "the selected `JUMENTIX_DATABASE_DRIVER`", so the module mirrors the
  Contract 1 enum sets — and the parity is asserted, not assumed (below).

**Proven by:**
[`serviceConfigurationValidation.test.ts`](../../apps/backend-template/test/unit/service-management/serviceConfigurationValidation.test.ts)
and
[`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts)
— the latter also reads `script.js` and the `server.js` allowlist enums to
assert the driver vocabularies cannot drift apart from the runtime-env
contract.

## Service Configuration: validate before state (JUM-544)

The tab's save gate validates the candidate profile **before it touches
state** (`script.js`): `collectServiceConfigurationIssues` runs over the form
values, and every issue is severity `error`, so an invalid profile is refused
and reported on the tab's status surface — the previous behaviour silently
coerced bad ports back to the defaults. The same collector re-validates the
persisted profile whenever the tab renders
(`renderServiceConfigStatus` in
[`inspectors.js`](../../apps/service-management/src/ui/inspectors.js)), so an
invalid state that arrives from storage is flagged instead of displayed as
valid. The rules:

1. **Vocabulary** — `serviceKind`, `runMode` and `cloudProvider` must be
   values the storage schema (Requirement 126, Contract 2) and the UI selects
   know.
2. **Ports** — every port the selected service kind actually binds must be an
   integer in 1–65535, and no two active ports may collide; inactive ports are
   ignored.
3. **Run mode × cloud provider** — the combination must exist in the shared
   matrix (above), and the rejection names the providers the matrix does
   support for the chosen run mode.

## Multi-environment editing (JUM-480) — by cross-reference

The runtime-environment editor's contract — accepted environments and their
file mapping, the three-tier key classification (editable / read-only / never
exposed), per-key enum sets, write semantics, and the error envelope — is
pinned by
[Requirement 126, Contract 1](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
and the E1 document,
[Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md).
What this document adds is only the console-side behaviour of that contract:

- **Editing is sequential and per-file.** The Environment selector (`dev`,
  `staging`, `ci`) loads exactly one environment at a time through
  `GET /api/runtime/env`; the panel always names the exact file the next save
  writes (`Editing target: .env.dev (environment "dev")`, straight from the
  API payload); and a save writes **only that file** — there is no cross-file
  batch edit. The per-file targeting line is pinned by
  [`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts).
- **An unaccepted environment is rejected, never coerced.** The server
  resolves the `environment` parameter against an explicit accepted set
  (`dev`/`development` → `.env.dev`, `staging` → `.env.staging`,
  `ci`/`test` → `.env.ci`) and answers an unknown value with `400` naming the
  accepted list — it never silently falls back to `dev`.
- **The save is validated and confirmed.** Only write-allowlisted keys are
  accepted, values are checked against the Contract 1 enum sets (out-of-enum
  values are rejected with the accepted list and nothing is written), the
  write is atomic (temp file, `fsync`, rename), and the response returns the
  post-write state the panel confirms (`Environment "staging" saved to
  .env.staging`).

## The PM2 ecosystem preview (JUM-480) — by source, not by command string

The runtime profile pane previews the PM2 processes the designed service kind
would run as. The one property that matters most about this preview — and the
one most likely to be undone by a future shortcut — is **where it reads
from**:

- **The preview reads the real `pm2/ecosystem.*.cjs` files** through
  `GET /api/runtime/pm2-ecosystem` (Requirement 126, Contract 1b), never a
  hardcoded process list. **Adding an app to an ecosystem file changes the
  preview with no code change and no server restart** — the endpoint loads the
  ecosystem module cache-busted on every read. The rationale belongs in
  writing: the day a contributor embeds a literal process list or a
  package-manager invocation in the designer, the preview starts lying about
  reality, and the Bun cutover
  ([JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun),
  [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover))
  will change the invocation format underneath it. That is why Contract 1b
  **forbids** any package-manager string (`pnpm run`, `bun run`, `npm run`) or
  `pm2:start:*` script name in the server and the designer: the reported
  command is *derived from the ecosystem definition* (its path and the app
  name), so it stays true whatever package manager invokes PM2. This document
  therefore describes the preview by its source, not by the literal command
  strings it currently produces.
- **Honest edge states, never a silently blank pane.** An environment without
  an ecosystem file (`ci`/`test` map to `ecosystem.ci.cjs`, which the
  repository does not define) is an explicit `exists: false` state rendered as
  "No PM2 ecosystem file for environment …", not an error and not an empty
  list presented as real. An unreadable or syntactically broken ecosystem file
  surfaces as the 500-class envelope with `code` and `path` — parallel to the
  env-file filesystem class (JUM-543) — so a broken
  `pm2/ecosystem.*.cjs` is identifiable as an installation problem, never
  mistaken for a malformed request.
- **The preview environment is independent of the editing environment.** The
  preview selector offers the environments the repository defines ecosystems
  for — `dev`, `staging`, `production` (pinned by the UI contract suite) —
  while the env editor targets the editable env files. Production has an
  ecosystem but no editable env file; the console keeps those axes separate
  instead of conflating them.
- **Filtering is by service kind, names come from the file.** The pane selects
  the ecosystem apps whose names end with the suffixes the designed service
  kind implies (`restapi` for REST-only, plus `websocketapi` or `grpcapi` for
  the realtime kinds) and suggests a single derived command covering exactly
  those apps. The suffix match works for every environment prefix because no
  app name is enumerated in the designer.
- **The preview is transient.** It lives in module-level UI state, never in
  the persisted `service-management.v1` payload (Requirement 126, Contract 2)
  — a server-derived snapshot is not design state.

**Proven by:**
[`pm2Ecosystem.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pm2Ecosystem.integration.test.ts)
(real ecosystem reads, edit-reflected-without-restart, explicit missing-file
state, honest 500 envelope, explicit rejection of unknown environments) and
[`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts)
(the structural no-hardcoded-commands guarantee over the designer sources).

## Deploy Management: the Requirement 059 metadata contract (JUM-481)

Every deploy target carries the Requirement 059 Service Management metadata
contract — `{ name, region, runtime, serviceType, deployTarget,
runtimeProtocol, databaseDriver, keyValueDriver, pm2Profile }` — pinned as a
backward-compatible extension of the storage schema (Requirement 126, Contract
2: the versioned key is unchanged). The tab's rules:

- **What a target may contain** is owned by `collectDeployTargetIssues`
  ([`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js)):
  the six vocabularies, the service-type × deploy-target matrix row, protocol
  exposure, and PM2-profile applicability — every rejection names the violated
  constraint (the shared matrix section above gives the reasons). Every issue
  is severity `error`.
- **The list re-validates every persisted entry.** `renderDeployments`
  ([`inspectors.js`](../../apps/service-management/src/ui/inspectors.js)) runs
  the collector over each stored target and flags a rejected entry inline with
  its issues, instead of rendering it as a buildable design. Validation is
  therefore enforced on the surface where targets are consumed, regardless of
  how the entry arrived.
- **Legacy entries migrate forward on load, losslessly.**
  `normalizeDeploymentInput`
  ([`designerState.js`](../../apps/service-management/src/state/designerState.js))
  migrates the pre-JUM-481 `{ name, type, region, runtime }` shape: `type`
  becomes `deployTarget` through an alias map (`dedicated` →
  `dedicated-server`), and missing metadata takes matrix-derived defaults —
  the first service type the target supports, that type's first protocol, the
  runtime-env contract's default drivers, and the `dev` PM2 profile on
  PM2-managed targets only. **Legacy values with no matrix counterpart (e.g.
  `azure-functions`) are kept verbatim** — the migration never silently drops
  information; the vocabulary rule flags the entry instead, and the operator
  decides. `normalizeStatePayload` restoring the `deployments` section at all
  is the JUM-481 exception to the pinned load slice.

**Proven by:**
[`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts)
and the load-migration coverage in
[`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts).

## Lifecycle rules — what exists today, and what is open

The issue chain reserves full lifecycle (edit-in-place, duplicate, field-level
validation, uniqueness) for both console lists to
[JUM-545](https://linear.app/jumentix/issue/JUM-545/feature-interface-adapter-lifecycle-edit-in-place-uniqueness-and)
(interface adapters) and
[JUM-546](https://linear.app/jumentix/issue/JUM-546/feature-deploy-target-lifecycle-edit-duplicate-and-field-validation)
(deploy targets). **Neither has landed** — this section records the lifecycle
the code actually implements today, so the gap is legible rather than
discovered by clicking.

**Interface adapters (Communication Interface Designer).** Today an adapter is
**added** and **deleted** — nothing else. The add gate
(`script.js`) requires the framework/runtime, entrypoint and controller
mapping to all be present before the `{ type, framework, entrypoint,
controller }` entry is stored; there is no edit-in-place, no duplicate, and no
uniqueness constraint — two identical adapters can be registered. JUM-545 owns
the missing rules, including the uniqueness constraints and their reasons.

**Deploy targets (Deploy Management).** Today a target is **added** and
**deleted**. The add gate (`script.js`) requires name, region and runtime and
records the chosen deploy target (the select carries the matrix spellings
since JUM-481); the entry is stored in the legacy field layout and **migrates
to the full metadata contract on the next load** (above), and until then the
list flags it exactly as it flags any entry the contract does not recognize.
Field-level validation of the six metadata fields at add time, edit and
duplicate are JUM-546's scope — the validation module's own header reserves
required-field presence and lifecycle for it.

The reason this honest-gap section exists at all: the console's lists are the
surfaces where a design becomes an operational intent, and an entry that only
*becomes* valid after a reload — or a duplicated adapter that nothing rejects —
is a rule the user cannot see. Naming the owning issues keeps the rule visible
until the code catches up.

## The status-surface contract every console surface follows (JUM-543)

The console never blocks on feedback. JUM-543 replaced every `window.alert`
with **non-blocking status surfaces**, and every console panel follows the
same model:

- **A single aria-live toast region** (`#status-region`, `role="status"`,
  `aria-live="polite"`) announces validation messages and API failures;
  info-severity notices auto-hide, errors persist. Destructive-action gates
  deliberately keep their `window.confirm` — a toast is not a substitute for a
  gate.
- **Inline status lines per panel** — the PM2 preview status, the Service
  Configuration status, the runtime-env status and the per-file targeting
  line — carry failures *with environment, file and cause* where the user is
  looking, instead of a silent console error.
- **The client renders the API's error envelope verbatim.** `error` /
  `details`, plus `code` and `path` on the 500 filesystem classes, are
  surfaced exactly as returned — there is no client-side error remapping, so
  the parse/validation/filesystem split documented in Requirement 126 reaches
  the user intact.

## What this document deliberately does not cover

- **Persistence and boot behaviour** — the `IDesignerStore` port and the
  landed Cana migration
  ([JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to))
  belong to the
  [E3 document](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md), and their
  user-facing promises to the
  [E6 document](./SERVICE-MANAGEMENT-CANA-ADOPTION.md).
- **Export/import of the console tabs** — the `interfaces`,
  `serviceConfiguration` and `runtimeEnvironment` sections do not cross any
  export path today; the E4 document names that boundary and its owning issue
  ([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration))
  in
  [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md).
- **The literal PM2 invocation format** — pinned by Requirement 126 Contract
  1b and due to change with the Bun cutover
  ([JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun),
  [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover));
  the preview is documented by its source precisely so this document survives
  that cutover.

## References

- Shared matrix reader: [`deployCapabilityMatrix.js`](../../apps/service-management/src/model/deployCapabilityMatrix.js); matrix documents: [Deploy Target and Packaging Matrix](./JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md), [Service Factory Capabilities Matrix](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md)
- Validators: [`serviceConfigurationValidation.js`](../../apps/service-management/src/validation/serviceConfigurationValidation.js), [`deployTargetValidation.js`](../../apps/service-management/src/validation/deployTargetValidation.js)
- Server endpoints: [`server.js`](../../apps/service-management/server.js); UI glue: [`script.js`](../../apps/service-management/script.js), [`inspectors.js`](../../apps/service-management/src/ui/inspectors.js), state/migration: [`designerState.js`](../../apps/service-management/src/state/designerState.js)
- Ecosystem sources: [`pm2/ecosystem.dev.cjs`](../../pm2/ecosystem.dev.cjs), [`pm2/ecosystem.staging.cjs`](../../pm2/ecosystem.staging.cjs), [`pm2/ecosystem.production.cjs`](../../pm2/ecosystem.production.cjs)
- Suites: [`serviceConfigurationValidation.test.ts`](../../apps/backend-template/test/unit/service-management/serviceConfigurationValidation.test.ts), [`deployTargetValidation.test.ts`](../../apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts), [`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts), [`pm2EcosystemUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts), [`runtimeEnvUi.contract.test.ts`](../../apps/backend-template/test/unit/service-management/runtimeEnvUi.contract.test.ts), [`pm2Ecosystem.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pm2Ecosystem.integration.test.ts), [`runtimeEnv.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/runtimeEnv.integration.test.ts), [`runtimeEnvContract.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/runtimeEnvContract.integration.test.ts)
- Requirements: [126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md) (Contracts 1, 1b and 2), [059](../../.agents/requirements/software/059-jumentix-service-factory-and-deploy-template-matrices.md) (the deploy and factory matrices), [076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md) (EN/PT parity)
- Sibling E-chain documents: [Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md) (E1), [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md) (E3), [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md) (E4), [Service Management Application](./SERVICE-MANAGEMENT-APPLICATION.md), [Domain Designer Features and Usage](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
- Linear: [JUM-480](https://linear.app/jumentix/issue/JUM-480/feature-real-multi-environment-editing-and-pm2-ecosystem-preview), [JUM-481](https://linear.app/jumentix/issue/JUM-481/feature-deploy-management-aligned-to-req-059-matrix-with-per-service), [JUM-543](https://linear.app/jumentix/issue/JUM-543/fix-replace-blocking-alerts-with-non-blocking-status-surfaces-and), [JUM-544](https://linear.app/jumentix/issue/JUM-544/fix-service-configuration-validation-port-conflicts-and-run-mode), [JUM-545](https://linear.app/jumentix/issue/JUM-545/feature-interface-adapter-lifecycle-edit-in-place-uniqueness-and), [JUM-546](https://linear.app/jumentix/issue/JUM-546/feature-deploy-target-lifecycle-edit-duplicate-and-field-validation), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration), [JUM-464](https://linear.app/jumentix/issue/JUM-464/docs-e1-documentation-enpt-runtime-env-contract-and-fixed-paths), [JUM-33](https://linear.app/jumentix/issue/JUM-33/refactor-migrate-internal-development-cli-and-pm2-workflows-to-bun), [JUM-40](https://linear.app/jumentix/issue/JUM-40/release-complete-the-bun-only-internal-tooling-cutover)
