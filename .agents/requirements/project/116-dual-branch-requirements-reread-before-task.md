# Requirement 116 - Dual-Branch Full Requirements Reread Before Every Task

- Status: Active
- Nature: NFR (governance, agent operations, anti-rework)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Amends / strengthens: `099`. Relates to: `084`, `081`, `068`.

## Requirement

1. **Every time an agent starts or resumes work on a Linear task, it MUST
   re-read the complete project requirements set from both integration tips:**
   - `origin/dev` — development SoT (Requirement `084`)
   - `origin/main` — released SoT

   “Complete set” means every file under `.agents/requirements/` plus
   `.agents/NFR-REGISTRY.md` on each tip. A cached summary from a prior session
   is not sufficient.

2. **Procedure (mandatory before planning or coding):**
   1. `git fetch origin dev main`
   2. Enumerate and read `.agents/requirements/*` and `.agents/NFR-REGISTRY.md`
      at `origin/dev`.
   3. Enumerate and read the same paths at `origin/main`.
   4. Diff the two tips for requirement/NFR drift and record material deltas in
      the task’s Linear Issue comment or Project Update.
   5. Only then produce a plan that avoids rework against already-shipped or
      already-specified behavior.

3. **Avoid rework.** If `dev` or `main` already contains the intended outcome,
   a superseding requirement, or an in-flight PR for the same scope, the agent
   MUST stop, report the overlap, and not duplicate implementation. Prefer
   extending or correcting existing delivery over parallel reinvention.

4. **This does not replace Requirement `099`.** `099` remains the pre-task
   branch/requirement refresh gate. This requirement adds the explicit
   **dual-branch, full-list reread** and the anti-rework obligation whenever a
   task is (re)started — including mid-epic task switches (Requirement `101`).

5. **Fail closed.** Uncertainty after the reread, unread applicable
   requirements, or ignored drift between `dev` and `main` blocks execution
   until resolved with the operator or via Linear.

## Evidence

- This requirement file
- Linear Project Update or Issue note listing `dev`/`main` SHAs and any
  requirement drift found before the task’s first product commit
- Agent Registry branch-check fields refreshed for both tips
