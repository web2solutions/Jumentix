# Requirement 139 - Agent Critique on Non-Automated Pull Requests to `dev`

- Status: Active
- Nature: NFR (governance, CI, pull-request review)
- Source: Project owner decision, 2026-10-23 (JUM-945).
- Relates to: `079`, `086`, `098`, `100`.

## Requirement

1. **A non-automated pull request targeting `dev` must carry a critique from a
   different agent.** The critique is a pull-request comment with exactly one
   marker:

   ```html
   <!-- jumentix-agent-critique: verdict=approve reviewer=<agent-id> -->
   ```

   `verdict` is `approve` or `request-changes`. `reviewer` is the critiquing
   agent's identifier and must differ from the pull request's
   `Epic-delegated agent ID`. The visible prose outside the marker is the
   critique and must be at least 40 characters.

2. **The latest such critique decides the gate.** `request-changes` blocks
   merge. The implementing agent fixes every point that critique names. The
   reviewer then posts a later comment with `verdict=approve`. A later
   `request-changes` opens the gate again. A critique whose reviewer is the
   implementing agent does not count.

3. **Automated pull requests are exempt.** Dependabot branches
   (`dependabot/...`), generated changelog sync, generated application release,
   and generated package content bumps do not require a critique. The
   classifier is `isAutomatedPullRequest` in `ci-cd/check-pr-governance.js`.

4. **The gate does not add a GitHub approval count.** Branch protection stays
   without a required approving-review count (`079`, `098`). Enforcement is the
   trusted-base check `ci-cd/check-pr-agent-critique.js`, invoked from
   `.github/workflows/pr-feedback.yml` and the `pr-feedback` job in
   `.github/workflows/ci.yml`. Pull requests whose base is not `dev` are outside
   this rule.

5. **Fail closed once the checker is on the trusted base.** The workflow runs
   the checker from the base checkout. Until the introducing merge lands the
   file on that base, the step records that the checker is absent and exits 0.
   After the file is on the base, a missing or failing critique fails the check.

## Evidence

- `ci-cd/check-pr-agent-critique.js`
- `ci-cd/test/check-pr-agent-critique.test.ts`
- `.github/workflows/pr-feedback.yml`
- `.github/workflows/ci.yml` (`pr-feedback` job)
- `bun run pr:agent-critique:check` (requires `GH_TOKEN`, `--repo`, `--pr`)
