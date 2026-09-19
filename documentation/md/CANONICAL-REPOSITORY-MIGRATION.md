# Canonical Repository

`web2solutions/Jumentix` is the public canonical repository for product source,
requirements, specifications, documentation, CI, and releases. Firestore is the
canonical agent-coordination store under Requirement `089`.

## Setup

```bash
git clone git@github.com:web2solutions/Jumentix.git
cd Jumentix
git switch dev
bun install --frozen-lockfile
```

## Delivery Policy

- Task branches start from and target `dev`.
- PR titles begin with the matching Linear ID: `[JUM-XXXX][Nature]`.
- CI, quality, coverage, security, governance, traceability, and valid-comment
  resolution remain mandatory.
- Missing, failed, skipped, cancelled, timed-out, or incomplete checks are not
  passing evidence and cannot be bypassed.

Historical repository migration evidence is summarized in
`documentation/md/HISTORICAL-TRANSITIONS.md`.
