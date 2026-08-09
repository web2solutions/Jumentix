# Agent Guide — `rtk` and Caveman

Operational guide for Requirement `127`. The requirement states the obligation; this file shows how
to meet it.

Two separate savings, one rule each:

- **`rtk`** compresses what the *tools* return to you.
- **Caveman** compresses what *you* return to the reader.

Neither is allowed to compress evidence. That exclusion is the whole reason the rest is safe.

## 1. Command map

Replace the left column with the right one. This is the entire day-to-day change.

| Instead of | Use |
| --- | --- |
| `bun run <script>` | `rtk proxy bun run <script>` |
| `git <cmd>` | `rtk git <cmd>` |
| `gh <cmd>` | `rtk gh <cmd>` |
| `bunx jest <paths>` | `rtk jest <paths>` |
| `eslint` / lint script | `rtk lint` |
| `tsc` | `rtk tsc` |
| `docker <cmd>` | `rtk docker <cmd>` |
| `grep` / `rg` | `rtk grep` / `rtk rg` |
| `find` | `rtk find` |
| `cat` / reading a file for context | `rtk read` |
| `curl` | `rtk curl` |

Run `rtk --help` for the full list; it covers pytest, cargo, go, mvn, kubectl and about forty others.

### Why `proxy` for Bun, and not `rtk npm`

`rtk` has no `bun` subcommand. `rtk npm run <script>` would work — and would run the script under
**npm**, not Bun. This repository pins Bun by Requirements `106` and `110`, and the test-runner rules
depend on that pin holding.

`rtk proxy` executes the command unchanged and still records usage:

```
rtk proxy bun run requirements:check
```

Use a native `rtk` subcommand whenever one exists for the tool; use `proxy` only where none does.

## 2. Reading `rtk` output

`rtk` output is terser than the raw tool. Two examples from this repository:

```
rtk jest apps/backend-template/test/unit/ci-cd/check-pr-governance.test.ts
PASS (30) FAIL (0)
```

```
rtk git push -u origin claude/governance/JUM-630-mandatory-rtk-and-caveman
ok claude/governance/JUM-630-mandatory-rtk-and-caveman
```

When a run fails, stop compressing and go get the real output. `rtk` is for the ninety-nine reads
that tell you nothing; the one that tells you something deserves the full text. `rtk err` and
`rtk test` filter to failures only, which is usually what you want at that point.

## 3. Caveman: compressing your own prose

Drop what carries no information: hedging, restatement of the question, narration of what you are
about to do, and adjectives that do not change a decision.

**Before**

> I went ahead and took a look at the integration test that was failing, and it seems like it might
> possibly be related to the change that landed recently, although I would want to verify that
> before saying anything definitive.

**After**

> Checked the failing integration test. Suspect the recent change. Not verified yet.

Same content, same uncertainty preserved. The hedge survived because the hedge was information.

## 4. What is never compressed

Reproduce these exactly as produced — full text, original wording, no rounding, no paraphrase:

- failing assertion output and error messages;
- test counts and pass/fail tallies;
- measured timings and durations;
- commit SHAs, branch names, issue identifiers, file paths;
- CI job, cell and check states.

**Wrong**

> The suite mostly passed and the browser test failed quickly.

**Right**

> `Tests: 1 failed, 52 passed, 53 total`. Failure at
> `pwaShell.browser.integration.test.ts:184`, in 2.65ms.

The second is longer and is the only one worth writing. A report that loses the number has not been
compressed; it has been degraded. If compressing a sentence would cost a fact, keep the sentence.

## 5. If your agent has neither tool

Requirement `127` rule 6: unavailability is not an exemption. Use a replacement pattern that reaches
the same outcome, and record it in your `.agents/AGENT-REGISTRY.md` entry.

Acceptable replacements:

- **For `rtk`** — pipe verbose commands through a filter you control: `2>&1 | tail -n 20`,
  `grep -E "error|fail"`, `--quiet` / `--reporter=dot` flags, or a wrapper script committed to the
  repository. The goal is that routine command output stops arriving in full.
- **For Caveman** — apply section 3 by hand. It is a writing discipline, not a binary.

What is not acceptable is skipping the obligation because a specific tool is missing.

## 6. Checking yourself

```
rtk gain
```

Shows token savings and history. If it reports nothing after a working session, you were not routing
commands through `rtk`.

`rtk` also warns `No hook installed — run 'rtk init -g' for automatic token savings`. That command
changes global configuration outside this repository; it is the operator's decision, not an agent's.

## Related

- Requirement `127` — the obligation.
- Requirements `106`, `110` — the Bun pin that makes `rtk proxy` necessary.
- Requirement `099` — reading the requirement registry before executing.
- [Portuguese version](AGENT-RTK-AND-CAVEMAN-GUIDE.pt-BR.md)
