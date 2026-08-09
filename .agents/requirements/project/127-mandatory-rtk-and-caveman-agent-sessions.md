# Requirement 127 - Mandatory `rtk` and Caveman in Every Agent Session

## Context

Agent sessions spend their context budget on two things: the output of the commands they run, and
the prose they write back. Both are compressible without losing a single fact.

`rtk` filters and summarises command output before it reaches the model. Caveman compresses the
agent's own prose. Neither touches the substance: `rtk` proxies real commands and returns their real
results, and Caveman is a style applied to explanation, not to evidence.

This is already Working Rule 1 in `CLAUDE.md` for `rtk`, and it was ignored for a full session by an
agent that had read the file. A rule stated only in an agent instructions file is followed by whoever
happens to read it carefully. `.agents/requirements/` is the registry every agent must read before
executing under Requirement `099`, and it is what the traceability ledger and coverage status track.

## Mandatory Rules

1. Every agent session must execute repository commands through `rtk`.
2. Every agent session must apply Caveman compression to its own prose.
3. Compression must never alter **code, commands, file paths, identifiers, error messages, test
   counts, timings, or CI check states**. These are reproduced verbatim, in full, however verbose.
4. `rtk` has no `bun` subcommand, and `rtk npm run` would substitute the runtime. This repository is
   Bun-pinned by Requirements `106` and `110`, so package scripts run as
   `rtk proxy bun run <script>`, which preserves the pinned runtime and keeps usage tracked.
5. Where a native `rtk` subcommand exists for a tool, it is used in preference to `proxy`:
   `rtk git`, `rtk gh`, `rtk jest`, `rtk lint`, `rtk tsc`, `rtk docker`, `rtk grep`, `rtk find`,
   `rtk read`.
6. Unavailability is not an exemption. An agent whose platform does not offer `rtk` or Caveman must
   use a replacement pattern achieving equivalent output filtering and prose compression, and must
   state which replacement it uses in its `.agents/AGENT-REGISTRY.md` entry.
7. The obligation is the outcome — filtered command output and compressed prose with verbatim
   evidence — not the specific binary. An agent may not skip the obligation because a specific tool
   is missing.

## Non-Negotiable Exclusions

Rule 3 exists because compression is worthless if it blurs what it is compressing. The following are
reproduced exactly as produced, never paraphrased, rounded, or summarised:

- failing assertion output and error messages;
- test counts and pass/fail tallies;
- measured timings and durations;
- commit SHAs, branch names, issue identifiers, and file paths;
- CI job, cell, and check states.

A report that says "the suite mostly passed" in place of `Tests: 1 failed, 52 passed, 53 total` has
not been compressed. It has been degraded.

## Acceptance Criteria

1. Agent instruction files state the `rtk` and Caveman obligation and point to this requirement.
2. Agents without either tool record their replacement pattern in `.agents/AGENT-REGISTRY.md`.
3. Requirement registry, NFR registry, traceability ledger, coverage status, and bilingual
   documentation remain synchronized.

## Evidence and Scope

- Applies to every registered agent across the monorepo, human-supervised or autonomous.
- Evidence is the agent's own transcript: commands issued through `rtk`, prose compressed, and
  excluded categories quoted verbatim.
- **Not machine-verifiable.** No gate can observe how an agent phrases prose or which wrapper it
  typed, so this requirement is attestation-based in the same way Requirement `090`'s delegation
  fields were before `JUM-627` made one of them verifiable against Linear. Adding a declared,
  checked field is a separate decision and belongs to its own issue.
- Complements requirements `099`, `106`, `110`, and `114`.
