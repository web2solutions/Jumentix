# 111 - Only Declared Identities May Commit

- Status: Active
- Nature: NFR (security, governance, CI/CD)
- Source: Project owner decision, 2026-07-31, following an authorship audit.
- Relates to: `065` (fail-closed checks), `086` / `099` (branch and task governance).

## Requirement

1. **Every identity permitted to author or commit in this repository is declared
   in `.agents/AUTHORIZED-COMMITTERS.json`.** The declaration is the complete
   list. An address absent from it is not permitted, whether or not anyone has
   objected to it before.

   Each entry records the address, whether it belongs to a person or a machine,
   its role, and why it exists. Adding one is a reviewed change like any other —
   that review is the control, and it is the reason the list is a tracked file
   rather than a branch-protection setting nobody reads.

2. **The list is an allowlist and must never be inverted into a denylist.**
   This is the rule most likely to be "simplified" later, so the reason is
   recorded here. The audit that produced this requirement began with a single
   corporate address the owner had noticed in the commit log. Enumerating the
   history for it turned up **a second corporate domain, from a former employer,
   that nobody was looking for and nobody had reported** — twenty-one commits
   across the two.

   A denylist blocks the leak someone already found. Only an allowlist blocks the
   one nobody has found yet, and the second domain is the proof, not a
   hypothetical.

3. **Both the author and the committer are checked, on every commit.** They are
   separate fields and they diverge on precisely the operations that rewrite
   identity — rebase, amend, cherry-pick, and merges performed through the forge
   UI. Validating one leaves the other free to carry anything.

4. **`ci-cd/check-commit-authorship.js` is the enforcement point**, and it fails
   closed under Requirement `065`. A missing declaration, an unparseable one, an
   empty identity list, an identity with no address, an absent or malformed
   history cutoff, or a git invocation that does not succeed each fail the check.
   None of them report success.

   The empty-list case is called out because it is the quiet way to disable this:
   leaving the file in place and emptying `identities` parses cleanly, iterates
   over nothing, and finds no violations.

5. **The check's scope is anchored to a fixed commit, not to a base branch.**
   A base-relative range (`origin/dev..HEAD`) is *empty* whenever the check runs
   on the branch the work was merged into — and an empty range passes while
   verifying nothing. Anchoring to `historyCutoff.commit` means the verified set
   only grows and the same rule holds on a feature branch, on `dev`, and on
   `main`.

6. **The history before the cutoff is out of scope, and that fact is recorded
   rather than left implicit.** Twenty-one commits reachable from
   `5a4ddda8cdb3934d7809252c6fd9de29ca39a781` carry non-approved corporate
   identities across two domains. They are already on `main`.

   They are not being rewritten, and the honest reason is that rewriting them
   would not accomplish what it appears to. Force-pushing the default branch
   invalidates every clone and every open pull request, and the forge still keeps
   the pre-rewrite objects reachable by SHA afterwards — so the addresses would
   remain retrievable by anyone who has one, while the cost lands on everyone.
   Removing them for real requires the forge operator to garbage-collect the
   unreachable objects, which is a support request, not a git operation.

   Recording the boundary matters as much as choosing it. A check whose scope
   silently begins partway through history reads, to anyone who runs it and sees
   it pass, as proof the whole history is clean. This history is not clean, and
   the declaration says so.

7. **No identity is configured globally on a contributor machine.** `user.email`
   is set per repository. A global identity is inherited by every repository on
   the machine, which is how an address from unrelated work reaches this one; with
   none set, git refuses to commit until an identity is chosen deliberately, so
   the failure mode is a stopped commit rather than a silent disclosure.

## Rationale

A commit's identity is not verified by anything. `user.email` is a string the
committer picks, and the forge renders it as fact.

That makes it a disclosure channel with an unusual property: it cannot be
retracted. A secret committed to a file can be rotated and removed. An address
written into commit metadata is copied into every clone, every fork, the pull
request UI, notification emails, and every downstream tool that reads commit
metadata — secret scanners name the "developer involved" from exactly this field.
Rewriting history does not remove it from the forge.

So the control has to sit before the commit spreads, and it has to be
enumerative. This requirement is the enumeration.

## Verification

- `bun run governance:check-authorship` — runs the check directly.
- The check runs inside `ci:gate`, so it gates every branch through both CI
  providers (Requirement `107`).
- `apps/backend-template/test/unit/ci-cd/check-commit-authorship.test.ts` proves
  the checker fails when it should: on an undeclared author, on an undeclared
  committer whose author is declared, on each fail-closed condition in §4, and —
  against a real throwaway repository rather than a fake `git` — that it exits
  non-zero and names the offending commit.
