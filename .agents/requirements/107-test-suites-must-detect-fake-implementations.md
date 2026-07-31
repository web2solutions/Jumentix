# 107 - Test Suites Must Detect Fake Implementations

- Status: Active
- Nature: NFR (testing, governance)
- Source: Project owner decision, 2026-07-30, following the HTTP adapter audit (Requirement `106`, Linear epic `JUM-570`).

## Requirement

1. **A test suite must be able to tell a real implementation from a fake one.**
   Asserting that behaviour is correct is not enough when a substitute can
   produce identical behaviour.

2. **Integration tests must reach 100% coverage** of the adapters and
   integrations they exercise. Anything below that means some integration path
   is only asserted by unit tests, which by construction cannot see the
   substitution.

3. Every adapter or integration must carry at least one assertion that **only
   the real dependency can satisfy** — a framework-specific artefact, not a
   response body that any HTTP server would produce.

## Why: the AdonisJS case

`adonis-js` served requests correctly and passed every test while integrating no
framework:

```ts
try {
  this.application.http = require('@adonisjs/http-server');
} catch (error) {
  this.application.http = null;
}
```

Routing ran on `find-my-way` over Node's `http`. The package was absent, the
catch fired on every start, and the field was always `null`.

**The tests could not have caught this, and that is the point.** They asserted
the HTTP contract: status codes, bodies, headers, auth behaviour. Node's `http`
satisfies that contract. So the suite proved the *port* worked, and said nothing
about the *adapter* — which is the only thing the adapter exists to be.

The same blindness applies well beyond HTTP. A cache adapter that quietly falls
back to a `Map`, a message mediator that drops to an in-process emitter, a
database driver that answers from memory — each passes a behavioural suite while
the integration it advertises is absent.

## What a detecting test looks like

The assertion must depend on something the substitute cannot produce. In rough
order of strength:

1. **Framework-owned behaviour.** A Fastify adapter serving a malformed JSON body
   returns Fastify's `FST_ERR_CTP_INVALID_MEDIA_TYPE`; Node's `http` returns
   nothing of the kind.
2. **Framework-owned surface.** The server instance exposes an API only that
   framework has — `app.printRoutes()`, `server.inject()`, a plugin registry —
   and the test calls it.
3. **Module identity.** The adapter's server is an instance of a class exported
   by the framework, asserted after the module resolves.
4. **Resolution.** The dependency is declared and `require.resolve` succeeds.
   Weakest, but it catches the swallowed-require shape outright.

A test that merely calls the endpoint and checks a 200 satisfies none of these.

## Enforcement

- Integration coverage of adapter and integration directories must be 100%,
  measured and gated, not sampled.
- A missing or unresolvable dependency must make its integration suite **fail**,
  never skip. A skipped suite reports green.
- The detecting assertion must fail when the framework is swapped for a
  substitute. A test that cannot fail proves nothing — the same rule
  Requirement `065` applies to gates, applied to tests.

## What this does not ask for

Testing the framework itself. Fastify's correctness is Fastify's problem. The
requirement is only that the suite can prove Fastify is *there* — one assertion
per integration, not a parallel test suite per dependency.

## Relationship to other requirements

- `106` — adapters must integrate their framework. That is a static check on the
  source; this is the runtime counterpart. `106` catches a swallowed require by
  reading the file; `107` catches an integration that silently degrades at
  runtime for any other reason.
- `065` — fail-closed, no false greens. A suite that cannot distinguish real from
  fake is a false green with extra steps.
- `057` / coverage policy — the 100% integration figure is stricter than the
  global threshold, deliberately: integration tests are the only place the
  substitution is visible at all.
