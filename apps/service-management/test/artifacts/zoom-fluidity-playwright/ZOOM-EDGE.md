# Zoom fluidity edge-case evidence

- Shell expected: **0.9.129**
- Steps: **16**
- FAIL: **0**

| # | case | before | after | shell | pass |
| --- | --- | --- | --- | --- | --- |
| 1 | shell | 1 | 1 | 0.9.129 | PASS |
| 2 | wheel-in | 1 | 2.5 | 0.9.129 | PASS |
| 3 | wheel-out | 2.5 | 0.79 | 0.9.129 | PASS |
| 4 | rapid-burst | 0.79 | 1.58 | 0.9.129 | PASS |
| 5 | toolbar-in | 1.58 | 1.98 | 0.9.129 | PASS |
| 6 | toolbar-out | 1.98 | 1.76 | 0.9.129 | PASS |
| 7 | keyboard | 1.76 | 1.98 | 0.9.129 | PASS |
| 8 | clamp-max | 1.98 | 2.5 | 0.9.129 | PASS |
| 9 | clamp-min | 2.5 | 0.25 | 0.9.129 | PASS |
| 10 | shift-nozoom | 0.25 | 0.25 | 0.9.129 | PASS |
| 11 | ctrl-pinch | 0.25 | 0.39 | 0.9.129 | PASS |
| 12 | delta-line | 0.39 | 0.54 | 0.9.129 | PASS |
| 13 | delta-page | 0.54 | 0.25 | 0.9.129 | PASS |
| 14 | interrupt-focus | 0.25 | 0.25 | 0.9.129 | PASS |
| 15 | fit-then-wheel | 0.25 | 0.99 | 0.9.129 | PASS |
| 16 | reset-then-wheel | 0.99 | 1.49 | 0.9.129 | PASS |

Hard Reload the live shell (`0.9.129`) before judging wheel feel in Brave.
