# 111 - Only Declared Identities May Commit and Push

- Status: Active
- Nature: NFR (security, governance, CI/CD)
- Source: Project owner decision, 2026-07-31, following an authorship audit.
- Relates to: `065` (fail-closed checks), `086` / `099` (branch and task governance).

## Requirement

1. **Every identity permitted to author, commit, or push in this repository is declared
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

3. **Both the author and the committer are checked, on every commit and before
   every push.** They are
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

5. **The check's scope is anchored to history itself, not to a base branch.**
   A base-relative range (`origin/dev..HEAD`) is *empty* whenever the check runs
   on the branch the work was merged into — and an empty range passes while
   verifying nothing. `historyCutoff.commit` takes either `ROOT`, meaning every
   commit back to the first, or a 40-character SHA to start after. Nothing else
   parses: an absent or free-form value would leave the scope undefined, and an
   undefined scope reads as a clean bill of health for history never examined.

6. **The declared scope is `ROOT`: the entire history, with no exemption.**

   This clause previously recorded the opposite. Twenty-one commits carried
   non-approved corporate identities across two domains, they were already on
   `main`, and the judgement here was that rewriting the default branch would
   cost every clone and open pull request while leaving the old objects reachable
   by SHA on the forge regardless.

   The owner overrode that judgement while the repository was private, which
   changes the arithmetic: with no outside clones to invalidate, the cost of the
   rewrite falls to nearly nothing. `dev`, `main` and all nine other branches
   were rewritten in place, mapping both domains onto the owner's declared
   identity. Trees were unchanged — no file moved, only authorship metadata.

   One consequence is worth keeping in view, because it is the trap this clause
   walked into: **the old cutoff SHA did not survive its own rewrite.** It still
   resolved on the machine that performed the rewrite, where the object lingered
   unreferenced, so the check kept passing locally — and would have failed closed
   on the first fresh clone in CI, where that object does not exist. A cutoff is
   a reference into the very history it describes, and rewriting that history
   invalidates it silently. `ROOT` has no such dependency.

7. **Commit creation and push publication have separate checks.** `pre-commit`
   runs `ci-cd/check-commit-authorship.js --identity` before a commit exists,
   so an undeclared email is blocked before Git writes irreversible metadata.
   `pre-push` runs `ci-cd/check-commit-authorship.js` before publication, so any
   existing local commit with an undeclared author or committer is blocked from
   reaching the forge. CI runs the same history check through `ci:gate`.

8. **No identity is configured globally on a contributor machine.** `user.email`
   is set per repository. A global identity is inherited by every repository on
   the machine, which is how an address from unrelated work reaches this one; with
   none set, git refuses to commit until an identity is chosen deliberately, so
   the failure mode is a stopped commit rather than a silent disclosure.

9. **Every commit must carry a GitHub-verified signature.** Authorized email
   metadata is necessary but no longer sufficient: protected branches must reject
   unsigned commits and commits signed by keys that GitHub cannot verify for the
   committing identity. AI agents and automation must use a verified signing key
   for the authorized account before they create or push commits.

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

Signature verification adds possession evidence to that enumeration: the commit
must come from an authorized identity and from a signing key the forge can
validate for that identity.

## Verification

- `bun run governance:check-authorship` — runs the check directly.
- `bun run governance:check-identity` — validates the identity Git would stamp
  on the next commit.
- The check runs inside `ci:gate`, so it gates every branch through both CI
  providers (Requirement `107`).
- `.husky/pre-commit` blocks undeclared author/committer identity before commit
  creation.
- `.husky/pre-push` blocks publishing any reachable commit with undeclared
  author/committer identity.
- GitHub branch protection rejects unsigned commits and commits whose signatures
  are not verified by GitHub.
- `apps/backend-template/test/unit/ci-cd/check-commit-authorship.test.ts` proves
  the checker fails when it should: on an undeclared author, on an undeclared
  committer whose author is declared, on each fail-closed condition in §4, and —
  against a real throwaway repository rather than a fake `git` — that it exits
  non-zero and names the offending commit.
