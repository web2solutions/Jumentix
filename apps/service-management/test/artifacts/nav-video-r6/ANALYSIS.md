# Nav video Round 6 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.141** at capture — R5 fixes live)
- Shell after fixes: **0.9.142**
- Video: `apps/service-management/test/artifacts/nav-video-r6/tour.webm`
- Verdict (probes): **PASS** (midInside=0; soft peers full inventory; secondary-not-scaled clean)

## Findings this round (vision on R5 residuals)

1. **Soft domain scale verified** — Users soft peer smaller/behind on `04`, `07`, `09`, `22`. Anchors aligned.
2. **ContactPoint packing** — Closer under Email/Phone (`04`); hull still slightly tall but usable.
3. **Deep zoom still voids on entity focus** — Capture re-selects Task before wheel-in; zoom anchor still used soft-peer **union** center → corridor void (`13`, `14`).
4. **Edge skim improved** — Cross-domain highways lift farther off soft borders (`09`, `12`); residual graze possible on curved overview.
5. **Relationship soft peers** — `12-edge-select` soft=9; both domains on stage.
6. **Probe clean** — soft-domain scale counted; no false secondary-not-scaled.

## Fixes applied (→ shell 0.9.142)

| Area | Change |
| --- | --- |
| Deep zoom | `selectionZoomAnchorPoint` locks onto focused **entity/field/domain** center (not soft-hull union) |
| Soft scale dial | Soft domain `0.94 → 0.92`; slightly deeper dim |

## Residual (post R6 — future polish)

- Soft scale may still want per-scenario tuning (domain vs entity focus).
- ContactPoint could share Email/Phone row if width allows (wider 3-col Users hull).
- Curved overview edges may still visually skim soft borders (orthogonal highways clearer).
- Capture wheel still aims at canvas center; pointer-anchor blend mitigates but extreme zoom can clip.
- MediaRecorder unavailable in WebKit headless (Playwright `tour.webm` primary).

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `07-entity-task`, `09-field-assigneeId`, `12-edge-select`, `13-zoom-wheel-in`, `14-zoom-wheel-out`, `22-esc-to-domain`
