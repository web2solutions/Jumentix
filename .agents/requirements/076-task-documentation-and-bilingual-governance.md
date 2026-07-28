# Requirement 076 - Task, Documentation, and Bilingual Governance

## Context

Jumentix requires strict delivery governance independent of execution agent (human or AI).
All executed work must be traceable in Linear, documented, and kept synchronized in product/software/spec resources (Requirement `095`).
Project communication surfaces (documentation and website) must support English and Portuguese.

## Requirement

1. Every executed task (by AI or humans) must have a corresponding Linear Issue and Linear Project item.
2. Every executed task must keep required governance metadata updated (status, priority, estimates, iteration/cycle, start/end dates, labels, assignee, PR/commit links).
3. Every executed task must include documentation updates whenever behavior, architecture, governance, product positioning, or contracts are impacted.
4. Software docs, product docs, and spec docs must be kept in sync and versioned together.
5. Documentation must have English and Portuguese versions.
6. Jumentix website must provide English and Portuguese versions for its content and navigation.
7. `.agents` and `.github` governance/automation files must remain English-only and must not receive Portuguese mirrored versions.

## Acceptance Criteria

- No implementation task is considered complete without a linked issue/project item.
- PRs include explicit task linkage and evidence of documentation synchronization.
- Documentation hubs expose EN/PT content paths (or clear language selector strategy) for equivalent content.
- Website routes/content provide EN/PT experience parity for main sections.

## Evidence and Scope

- Governance source of truth: Linear (`https://linear.app/jumentix`).
- Applies to all components: monorepo root, backend template, service management, packages, website, and specs.
- Complements and extends requirements `025`, `056`, `064`, `066`, `067`, `071`, and `072`.
