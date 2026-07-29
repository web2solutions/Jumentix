# Spec Lifecycle and Workflow

This lifecycle is mandatory for Jumentix delivery.

## Phase 1 - Intake

Inputs:

- Business intention (feature, bugfix, refactor, compliance)
- Scope and risk
- Affected domains/interfaces/runtimes

Required outputs:

1. Linear Issue created
2. Issue added to Linear
3. Project fields filled (`Status`, `Priority`, `Size`, `Estimate`, `Start date`, `End date`)
4. Initial acceptance criteria

## Phase 2 - Spec Drafting

Create or update specification artifacts before coding:

- Contract specs (OpenAPI/AsyncAPI)
- Architecture-impact note (if boundaries, flow, or dependencies change)
- Domain/data contract updates (entities, models, value objects)
- Governance and NFR references (affected requirement IDs)

Required outputs:

1. Spec change list documented
2. Traceability list (`issue -> spec files`)
3. Risk and compatibility notes

## Phase 3 - Design Validation

Validate spec design against baseline principles:

- DDD + Event-Driven + Hexagonal boundaries
- Layer call order
- No circular dependency reintroduction
- Contract-first interface behavior
- Security and tenancy requirements

Required outputs:

1. Boundary impact statement
2. Compatibility statement (runtime/adapters/SDKs)
3. Test strategy aligned to change risk

## Phase 4 - Implementation

Code only what the approved spec requires.  
Do not expand scope without spec update.

Implementation rules:

1. Keep changes feature-driven and layer-local.
2. Reuse established contracts and package abstractions.
3. For adapter behavior changes, keep runtime-native patterns.
4. Maintain docs/spec synchronization in same delivery cycle.

## Phase 5 - Verification

Mandatory verification evidence:

1. Lint and architecture checks
2. Unit/integration/smoke coverage for changed behavior
3. Contract resolution checks (`oas:check-routes`, async mappings when relevant)
4. Security and compliance checks
5. Patch coverage threshold gate

Required outputs:

- CI evidence showing checks are green
- Coverage evidence meeting threshold policy

## Phase 6 - Governance Closure

Before merge:

1. PR links the Linear Issue, focused Project, milestone, and required Project Update
2. PR includes spec artifacts changed
3. PR includes acceptance criteria evidence
4. Linear Issue remains in the truthful review state until merge, then moves to `Done`
5. Requirement/NFR docs are updated when behavior is non-functional

## Definition of Done (Spec-Driven)

A change is done only when all are true:

1. Business intent is represented by a tracked Linear Issue in its focused Project.
2. Specs are updated and versioned.
3. Code matches the updated specs.
4. Tests and quality gates pass.
5. Documentation and agent registries are synchronized.
6. Traceability from Linear Issue and Project Update to PR and spec files is explicit.
