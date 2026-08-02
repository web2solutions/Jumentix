# Requirement 115 - Functional Value Tests; No Fakes; No Third-Party API Suites

- Status: Active
- Nature: NFR (testing, quality, false-green resistance)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Relates to: `065`, `109`, `110`, `112`. Amends informal “coverage for coverage’s sake” practice.

## Requirement

1. **Tests are mandatory** for every change that alters behavior, contracts,
   adapters, packages, apps, or CI-governed surfaces. A change without tests
   that can fail when the change is wrong is incomplete and MUST NOT merge.

2. **No fake tests.** The following are forbidden and are not green:
   - suites that always pass regardless of implementation (vacuous asserts,
     `expect(true).toBe(true)`, empty bodies, permanently skipped/pending cases
     presented as coverage);
   - suites that only assert mocks were called without exercising Jumentix
     behavior or contracts;
   - suites that re-implement or rubber-stamp a third-party library’s own unit
     tests under a Jumentix path.

3. **Do not write tests whose primary subject is a third-party implementation
   API.** Testing that Express parses JSON, that Redis `SET` stores a string, or
   that IndexedDB in Chrome supports a standard method belongs to those vendors.
   Jumentix suites MUST instead assert **Jumentix behavior**: our adapters’
   wiring, our contracts, our failure modes, our tenancy/RBAC rules, our
   composition, our observability, and our integration of those dependencies
   into this product.

   Allowed: “when the Restify adapter boots with this env, `/health` returns the
   Jumentix envelope and auth middleware runs.”  
   Forbidden: “calling `res.send` on a raw Restify response object sets status
   code 200” as a suite that only proves Restify.

4. **Tests MUST be functional and add value to Jumentix.** Each suite answers a
   product or architecture question a maintainer would care about if it failed.
   Prefer behavior at ports, use cases, adapters-as-integrated, and regression
   guards for real bugs over structural trivia.

5. **Fakes and shims** remain constrained by Requirement `109` and `112` §4
   (browser packages use real browsers). A fake is allowed only when it is the
   declared in-memory/test double of a **Jumentix port**, not when it is a
   substitute that silently hides the third-party surface the adapter claims to
   integrate.

6. **Fail closed.** Reviewers, agents, and gates treat vacuous or third-party-
   API-only suites as defects. Prefer deleting them over keeping false greens.

## Evidence

- This requirement file
- Suites under `apps/*/test` and `packages/*/test` that assert Jumentix behavior
- Related enforcement: `109` (detect fake adapters), `112` (package-owned suites),
  `065` (no synthetic green)
