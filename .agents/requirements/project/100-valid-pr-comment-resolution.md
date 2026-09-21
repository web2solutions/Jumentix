# Requirement 100 - Valid PR Comment and Thread Resolution

Every valid pull-request comment is a mandatory merge blocker. The GitHub
Actions `pr-feedback` required check enforces this rule for every PR targeting
`dev` or `main`; it runs the verifier from the trusted base SHA with a read-only
GitHub token and fails closed on an unavailable token, API error, or incomplete
pagination.

Every GitHub review thread that is not explicitly exempt must have native
`isResolved=true`. Every general PR comment must either be explicitly exempt or
have visible evidence posted by the PR author or a repository `OWNER`, `MEMBER`,
or `COLLABORATOR`. Evidence is one of these exact HTML markers:

```html
<!-- jumentix-pr-feedback: resolved comment=https://github.com/OWNER/REPO/pull/NUMBER#issuecomment-ID commit=PR_COMMIT_SHA -->
<!-- jumentix-pr-feedback: invalid comment=https://github.com/OWNER/REPO/pull/NUMBER#issuecomment-ID -->
```

`resolved` must reference the exact general-comment URL and a unique SHA that
belongs to the PR. `invalid` must reference the exact URL and retain a factual,
visible explanation outside the marker. Markers are evidence, not new pending
comments; malformed markers, URLs from another PR, external SHAs, self-resolution,
and evidence from an unauthorized author fail the check.

The only versioned exception is a general comment authored by login exactly
`cursor` whose text is a Cursor inability notice containing `out of credit`,
`out of limit`, `usage limit`, or `usage or spend limit`. It does not exempt a
similar message from any other author, another Cursor message, SonarCloud,
Codecov, or a human review. Those comments require the same visible evidence.
