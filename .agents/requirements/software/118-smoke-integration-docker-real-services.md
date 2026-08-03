# Requirement 118 - Smoke and Integration Tests Use Docker and Real Services

- Status: Active
- Nature: NFR (testing, CI/CD, false-green resistance)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Strengthens: `046`, `047`. Relates to: `065`, `105`, `109`, `115`.

## Requirement

1. **Smoke and integration suites MUST use Docker to start the dependent
   services they claim to exercise**, then run assertions against those running
   services. Examples include Redis, PostgreSQL, MySQL, MongoDB, and other
   drivers/stacks already represented by compose files under the repository.

2. **“Test everything” means the suite’s declared surface**, not a silent subset:
   - Integration targets mapped in `test-map.json` / `INTEGRATION_SCRIPTS` boot
     the real adapter stack under test against Dockerized dependencies when the
     adapter requires them.
   - Database driver smoke (`test:smoke:db:*`) brings compose services up,
     runs the smoke, and tears them down (existing per-driver compose workflows
     are the pattern to extend, not bypass).
   - Realtime/redis-streams and mutex suites that require Redis MUST start Redis
     via Docker (or the repository’s documented compose helper) rather than
     skipping when Redis is absent.

3. **No silent skip as green.** If Docker or a required service cannot start,
   the suite fails closed (Requirement `065`). Omitting the suite from a local
   developer shortcut is allowed only when an explicit non-gate profile is
   documented; gate/nightly/CI paths MUST run the Docker-backed flow.

4. **Alignment with functional-test rules (Requirement `115`).** Docker-backed
   suites assert Jumentix integration behavior (boot, auth, contracts, multi-
   instance coordination, driver selection) — not vendor API trivia.

5. **Tiering.** Expensive full-matrix Docker stacks may remain on `tier:
   "nightly"` or release/`main` strict gates per Requirement `105`, but they
   still MUST use Docker and real services when they run. Moving a suite to
   nightly is not permission to replace Docker with mocks.

6. **Evidence.** Compose files, scripts that `docker compose up/down`, and CI
   jobs that invoke them are part of the contract. A smoke/integration cell that
   passes without containers for a container-dependent target is a defect.

## Evidence

- This requirement file
- Per-database compose + `smoke:db:*` scripts
- Redis-backed integration/smoke entry points using Docker
- `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md` and realtime testing docs
  updated when new Dockerized targets are added
