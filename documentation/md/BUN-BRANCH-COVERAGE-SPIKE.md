# JUM-541 — Bun branch-coverage spike vs 90% branch threshold

Date: 2026-07-30  
Bun pin: `1.3.14` (`.bun-version`)

## Question

Does `bun test --coverage` emit trustworthy BRDA/BRF/BRH records adequate for the Jest-era 90% branch threshold (Reqs 014/020/063)?

## Method

1. Ran `bun test --coverage --coverage-reporter=lcov` on a Bun-compatible unit subset under `apps/backend-template/test/unit/modules/Users/domain`.
2. Inspected `coverage/lcov.info` for `BRDA:` / `BRF:` / `BRH:` records.
3. Compared shape (not absolute %) with a Jest LCOV sample from the same files when available.

## Verdict

| Check | Result |
| --- | --- |
| LCOV file produced | Yes |
| Line (`DA:`) records | Present |
| Branch (`BRDA`/`BRF`/`BRH`) records | **Present on Bun 1.3.14 for this subset** |
| Threshold fail-closed on branch shortfall | Enforce via merged LCOV + existing Jest/Codecov thresholds until Bun-native threshold flags are adopted repo-wide |

**Decision for JUM-437:** keep the 90% branch bar. Merge Bun + Node LCOV with first-seen-file wins (`ci-cd/merge-coverage-reports.js`) so Codecov/Sonar do not double-count. If a future Bun release drops BRDA, reopen this spike before lowering the bar.

## Fallback (if BRDA disappears)

1. Keep Jest coverage as the branch-metric authority under `ciRunner: "node"` for the affected suites.
2. Do **not** silently drop the branch dimension from thresholds.
3. File a follow-up against the Bun epic toolchain pin.

## Evidence commands

```bash
bun test --coverage --coverage-reporter=lcov apps/backend-template/test/unit/modules/Users/domain
rg -n '^BR(DA|F|H):' coverage/lcov.info | head
bun run coverage:merge
```
