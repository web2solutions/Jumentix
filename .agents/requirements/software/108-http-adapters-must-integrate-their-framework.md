# 108 - HTTP Adapters Must Integrate the Framework They Are Named For

- Status: Active
- Nature: NFR (architecture, governance)
- Source: Project owner decision, 2026-07-30. Audit recorded in Linear epic `JUM-570`.

## Requirement

1. An HTTP adapter named for a web framework **must import that framework and
   use it**. Implementing the `HTTPBaseServer` port over Node's `http` while
   carrying a framework's name is forbidden.

2. **A reference is not a use.** A `require` whose result is assigned to a field
   and never read does not satisfy this. Neither does one wrapped in a
   `try/catch` that swallows the failure — see below.

3. **The framework must be a declared dependency.** An import that no manifest
   resolves is an adapter that cannot start, whatever its code says.

4. Adapters for **platform targets with no framework** — AWS Lambda, Vercel
   Functions — are exempt. Their contract is a handler signature, not a server.
   The exemption is by explicit listing, never by inference.

5. **Any violation must be registered as a Linear task.** A gap that is tracked
   is a decision; a gap that is merely present is a defect pretending to be a
   feature.

6. A **new** violating adapter fails `ci:gate`. Existing ones are held in a
   registry naming their Linear issue, so the gate stays honest without going
   permanently red — a red gate gets bypassed, and a bypassed gate protects
   nothing.

## The two shapes this forbids

The audit found both, and the second is why §2 exists.

### Undeclared dependency — fails loudly

`feathers`, `loopback`, `sails-js` and `derby-js` integrate their frameworks
correctly: `feathers()`, `new RestApplication()`, `new Sails()` then
`sails.lift()`, `derby.createApp()`. The code is right.

None of those packages is declared in any manifest or present in
`node_modules`, so `bun run dev:sails-js` fails with *Cannot find module*. The
adapter cannot start. This is the safe half of the problem, because it announces
itself the moment anyone tries.

Typecheck passes regardless, because each uses a lazy `require` rather than a
top-level `import` — one file even says so: *"Lazy require keeps compilation
independent from optional framework install."* That is how an adapter that
cannot run reached a green typecheck and a README badge.

### Swallowed require — fails silently, and is worse

`adonis-js` and `total-js`:

```ts
try {
  this.application.http = require('@adonisjs/http-server');
} catch (error) {
  this.application.http = null;
}
```

The framework is assigned to a field and never used. Routing runs on
`find-my-way` over Node's `http`. The package is absent, so the catch fires on
every start and the field is always `null` — and the server works perfectly.
Requests are answered. Nothing complains.

This shape satisfies every grep for the framework name, satisfies a reviewer
skimming the file, and satisfied the first version of the checker written for
this requirement. It is a false green wearing an import statement, and it is the
reason the checker reads more than the import list.

## Enforcement

`ci-cd/check-http-adapter-authenticity.js`, wired into `ci:gate`, fails when an
adapter:

- never references its framework;
- references it only inside a swallowed `try/catch`;
- integrates it while no manifest declares it;
- is unclassified — neither assigned a framework nor listed as a platform target;
- is listed as a known gap **after having been fixed**, so the registry cannot
  decay into a permanent allowlist.

## Known gaps

Tracked under Linear epic `JUM-570`. Each resolves by integrating properly
**or** by removing the adapter. Removal is a legitimate outcome and should not be
read as failure — four adapters that cannot start, plus two that quietly serve on
Node `http`, are worth less than the four that genuinely work.

| Adapter | Issue | Defect | Framework |
|---|---|---|---|
| `adonis-js` | JUM-571 | swallowed require | `@adonisjs/http-server` |
| `total-js` | JUM-576 | swallowed require | `total4` |
| `feathers` | JUM-572 | undeclared dependency | `@feathersjs/feathers` |
| `loopback` | JUM-573 | undeclared dependency | `@loopback/rest` |
| `sails-js` | JUM-574 | undeclared dependency | `sails` |
| `derby-js` | JUM-575 | undeclared dependency | `derby` |

Verified compliant: `express`, `fastify`, `restify`, `cloudflare-workers`
(Hono). Exempt as platform targets: `aws`, `vercel-functions`.

## A note on how this audit went

The first pass concluded that six adapters imported no framework at all. That
was wrong — the search behind it matched only single-line top-level imports and
missed subdirectories and every `require()` call. Four of the six turned out to
have solid integrations with a missing dependency, and the remaining two had a
defect of a different and more subtle kind.

It is recorded here because the same mistake is easy to repeat: an adapter's
integration may live in a lazy `require` inside a method, and a search that only
reads the top of the file will report the opposite of the truth.

## Relationship to other requirements

- `015`/`016` (hexagonal boundaries) — an adapter exists to keep a framework out
  of the domain. One that integrates no framework has nothing to isolate, which
  is how the emptiness went unnoticed.
- `065` (fail-closed, no false greens) — this is the architectural form of the
  same rule.
- `096` — any framework added under this requirement must run on the pinned Bun
  toolchain. `hyper-express` was dropped for exactly this reason:
  `uWebSockets.js` is not an N-API module and cannot run on Bun at all.
