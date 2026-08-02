# Canonical Repository Migration

## Active repositories

Jumentix development and coordination use these private canonical repositories:

| Responsibility | Canonical repository |
| --- | --- |
| Product, source, requirements, specs, docs, CI, and releases | `XpertMinds/Jumentix` |
| Agent registration, assignments, and branch checks | `XpertMinds/jumentix-agent-registry` |

New work must be created only in these repositories. Access requires an identity
authorized by the project owner and recorded in Linear.

## Deprecated repositories

The following repositories are historical, read-only, and accept no new
modifications:

- `web2solutions/aaa-typescript-boilerplate`
- `web2solutions/jumentix-agent-registry`

They remain archived after the final migration PR to `dev`. Existing links may
be retained only when they are clearly historical delivery evidence.

## Clone and registry setup

```bash
git clone git@github.com:XpertMinds/Jumentix.git
cd Jumentix
git switch dev
bun install --frozen-lockfile
```

Agent-registry consumers set `GITHUB_TOKEN` or `GH_TOKEN` with private read
access. The token must never be logged, committed, embedded in URLs, or copied
into documentation. Mirrors pin the full immutable registry commit.

## Delivery policy

- Task branches start from and target `dev`.
- PR titles begin with the matching Linear ID: `[JUM-XXXX][Nature]`.
- Review approval count is optional.
- CI, quality, coverage, security, governance, traceability, and valid-comment
  resolution remain mandatory.
- Missing, failed, skipped, cancelled, timed-out, or incomplete checks are not
  passing evidence and cannot be bypassed.

## Traceability

- Requirement: `103`, `104`
- Linear epic: `JUM-562`
- Documentation task: `JUM-563`
- Application integration task: `JUM-568`
- Integration contract: `INTEGRATION-MIGRATION-REQUIREMENT.md`
