# Nav video Round 5 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.140** at capture — R4 fixes live)
- Shell after fixes: **0.9.141**
- Video: `apps/service-management/test/artifacts/nav-video-r5/tour.webm`
- Verdict (probes): **PASS** (midInside=0; soft peers full inventory)
- Probe note: `secondary-not-scaled` medium was a false positive (soft scale lives on domain; nested entity soft stays 1) — probe updated.

## Findings this round (vision on R4 residuals)

1. **Soft domain CSS scale works** — Users soft peer clearly smaller/behind on `04`, `07`, `22`. Anchors stay glued (DOM rects).
2. **ContactPoint packing improved** — Hull 760 / y:548; less empty band (`03`, `22`). Still slightly loose under Email/Phone.
3. **Deep zoom still voids** — `13-zoom-wheel-in` still empty. Root cause: zoom blend used soft-peer **union center** (corridor void) for relationship focus.
4. **Edge skim** — Cross-domain highways still graze soft-domain tops (`03`, `09`).
5. **Relationship framing OK** — `12-edge-select` keeps both domains (soft=8).
6. **Field assigneeId** — Soft Users peer retained (`09`); title stays local (`10`).

## Fixes applied (→ shell 0.9.141)

| Area | Change |
| --- | --- |
| Deep zoom | `selectionZoomAnchorPoint()` — relationship uses endpoint corridor mid; stronger blend |
| Edge skim | Cross-domain highways include domain tops/bottoms; larger lift pads (`28..96`) |
| Probe | Count soft-domain + quiet-entity scales so secondary-not-scaled is truthful |

## Residual (post R5 — future polish)

- Soft scale dial (0.94 → 0.92) if peers still read too large next to focus.
- ContactPoint could sit ~20px higher if Email height allows.
- Extreme wheel-in may still void if pointer starts far off corridor.
- MediaRecorder unavailable in WebKit headless.

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `07-entity-task`, `09-field-assigneeId`, `10-field-title`, `12-edge-select`, `13-zoom-wheel-in`, `22-esc-to-domain`
