# Requirement 117 - Feature Documentation on Every New Feature

- Status: Active
- Nature: NFR (documentation, product governance)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Strengthens: `025`, `076`, `018`, `094`. Relates to: `093`.

## Requirement

1. **Every new feature delivery MUST update the software documentation in the
   same change set (or the same task PR) as the code.** A feature PR without
   documentation updates is incomplete and MUST NOT merge.

2. **Documentation for the new feature MUST be added**, not only mentioned in
   a changelog. Minimum deliverables:
   - A dedicated feature document under `documentation/md/` (and `.pt-BR.md`
     per Requirement `076`) **or** a clearly scoped addition to the owning
     app/package guide that a new engineer can find from the docs index;
   - Updates to the relevant indexes (`documentation/README.md`, consumer/creator
     indexes, and root `README` links when the feature is user-visible);
   - Updates to architecture/runtime/testing docs when the feature changes
     those contracts.

3. **“Feature” includes** user-visible product capability, new workspace
   package, new adapter/runtime mode, new public CLI, and new governed
   operator workflow. Pure internal refactors still require docs when they
   change contracts, commands, or operator procedures.

4. **Language and traceability.** EN and PT-BR stay in sync (Requirement `076`).
   The Linear Issue and PR must link the new/updated docs. Epic documentation
   completion (Requirement `094`) still applies at Project close.

5. **Fail closed.** Missing feature docs, EN-only feature docs when PT is
   required, or docs that describe intent without the shipped behavior, block
   review readiness and merge.

## Evidence

- This requirement file
- Feature docs under `documentation/md/` (+ pt-BR) and index links
- PR template sections listing documentation paths touched
