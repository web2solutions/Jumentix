# Requirement 080 - Agent Registry Machine and Version Identity

## Context

The same host machine may run multiple agents concurrently. Auditability requires unambiguous machine and agent runtime identification per registration.

## Requirement

1. Every registered agent must include machine identity metadata.
2. Every registered agent must include explicit agent runtime name and version.
3. Registry format must support multiple distinct agents on the same host machine.

## Required Fields

1. `machine_id`: stable machine identifier used for audit correlation.
2. `machine_name`: human-readable host name.
3. `machine_os`: runtime operating system and architecture summary.
4. `agent_runtime`: runtime/distribution name used to execute the agent.
5. `agent_version`: version string of the running agent/runtime.

## Acceptance Criteria

1. Firestore agent documents include machine and agent version fields.
2. Existing registered agents include populated machine and version metadata.
3. Governance docs reference the expanded registry identity contract.
