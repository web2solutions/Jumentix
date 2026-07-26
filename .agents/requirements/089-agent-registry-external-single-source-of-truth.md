# Requirement 089 - Agent Registry External Single Source of Truth

## Context

Agent coordination must be centralized across repositories and runtimes. Keeping registry state only inside this repository can create drift between collaborating services and agents.

## Requirement

1. The agent registry must be tracked in an independent GitHub repository.
2. That independent repository is the single source of truth for agent coordination.
3. This repository must treat `.agents/AGENT-REGISTRY.md` as a mirrored copy of the external canonical registry.
4. Local mirror synchronization must be automated through executable tooling.

## Canonical Registry Repository

- `https://github.com/web2solutions/jumentix-agent-registry`
- Branch: `main`
- Canonical file: `AGENT-REGISTRY.md`

## Integration Plan

1. Phase 1 - Repository foundation:
   - create/publish independent registry repo;
   - store canonical `AGENT-REGISTRY.md`.
2. Phase 2 - Local integration:
   - add source configuration in this repository;
   - add executable `check` and `sync` commands.
3. Phase 3 - Governance enforcement:
   - include registry source check in local/CI quality flow;
   - document operation and fallback behavior.
4. Phase 4 - Operational lifecycle:
   - update canonical registry first;
   - sync mirrors in consumer repositories.

## Acceptance Criteria

1. Independent registry repository exists and is published.
2. This repository has executable commands to check and sync the mirrored registry file.
3. Governance docs clearly identify the external repo as single source of truth.
