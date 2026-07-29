# Contributing and Tooling

## Contributing

1. Create a branch.
2. Ensure there is a related Linear Issue and it is added to the **Jumentix** project:

```text
https://linear.app/jumentix
```

3. Set/update Linear fields for the Issue and Project (`Status`, `Priority`, `Size`, `Estimate`,
   `Start date`, `End date`, milestone, and primary nature).
4. Run TDD mode:

```bash
pnpm run tdd
```

5. Make your changes.
6. Commit using:

```bash
pnpm run commit
```

This command runs lint/tests and then opens commitizen flow.

PRs must include the Linear Issue, focused Project, milestone, required Project Update, and
GitHub delivery evidence.

## Tooling

Lint:

```bash
pnpm run lint
```

Lint + fix:

```bash
pnpm run lint:fix
```

Update changelog from git history:

```bash
pnpm run changelog:update
```

Validate changelog is synced:

```bash
pnpm run changelog:check
```

Architecture and contracts:

```bash
pnpm run deps:check-cycles
pnpm run arch:check-boundaries
pnpm run arch:check-users-legacy-imports
pnpm run oas:check-routes
```

Node runtime check:

```bash
pnpm run check-node-version
```

Smoke and CI gate:

```bash
pnpm run ci:smoke
pnpm run ci:gate
```
