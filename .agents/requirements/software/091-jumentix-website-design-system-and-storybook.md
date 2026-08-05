# Requirement 091 - Jumentix Website Design System and Storybook

## Context

Jumentix exposes a large product and technical knowledge surface. Its public website requires a
cohesive, accessible component language that supports commercial pages, dense documentation,
code-first explanations, and future growth without page-level UI duplication.

## Mandatory Rules

1. Website design tokens are centralized under
   `apps/jumentix-website/components/design-system`.
2. Tokens must define color, typography, spacing, radius, elevation, motion, content width, and
   light/dark surface behavior.
3. The visual system must be recognizably Jumentix and may learn interaction and information
   architecture patterns from reference products without copying their identity.
4. Cards and framed controls use a maximum radius of eight pixels unless an established compact
   control convention requires a pill shape.
5. The palette must combine neutral surfaces with functional blue, green, coral, and yellow
   signals; a one-note palette is prohibited.
6. Reusable components must cover product navigation, footers, actions, badges, headings,
   feature grids, callouts, metrics, capability tables, code tabs, search, pagination, locale
   selection, documentation controls, and architecture diagrams.
7. Code widgets must expose semantic tabs, a named copy action, horizontal overflow, stable
   dimensions, and keyboard focus.
8. Every component exported from the design-system public entry point must have at least one
   meaningful Storybook story. Interaction-heavy and responsive components require relevant
   state variants.
9. Storybook must support autodocs, accessibility analysis, light/dark themes, responsive
   viewports, and public static assets.
10. Reduced-motion preferences, visible keyboard focus, semantic landmarks, labelled controls,
    readable contrast, and non-overlapping responsive layouts are mandatory.
11. Storybook output is generated, must not be committed, and must be reproducible from the pnpm
    workspace lockfile.
12. Root and website package scripts must expose Storybook development, build, and smoke checks.
13. Storybook smoke validation must inspect the generated story index and fail when required
    foundation stories or the expected minimum inventory are missing.
14. Design-system behavior, commands, inventory, and contribution workflow must be documented in
    English and Portuguese.
15. Storybook development, build, smoke, accessibility, and component tests belong exclusively to
    the `apps/jumentix-website` workflow.
16. Storybook checks must not be included in, coupled to, or block the main monorepo workflow,
    global test matrix, backend-template workflow, package workflow, or unrelated application
    workflow.
17. Root-level `website:storybook*` scripts are convenience entry points that delegate to the
    website workspace. Their presence must not be interpreted as ownership by the main monorepo
    workflow.
18. Website pull requests and website releases may require Storybook checks. Changes outside the
    website must not run Storybook unless they directly affect a website-consumed contract and the
    website workflow explicitly selects that validation.

## Acceptance Criteria

1. Website TypeScript validation passes.
2. Storybook static build completes without story compilation errors.
3. Storybook smoke validation proves at least twenty indexed entries and required foundation
   stories.
4. The catalog can be inspected in desktop/mobile and light/dark states.
5. The design-system documentation lists every public component and the command workflow.
6. Generated Storybook output remains ignored by Git.
7. Main monorepo gates pass without building or testing Storybook.
8. The website workflow independently runs and reports its required Storybook checks.

## Evidence

- GitHub epic `#167`
- GitHub task `#170`
- GitHub CI task `#191`
- Linear CI task `JUM-504`
- `apps/jumentix-website/components/design-system`
- `apps/jumentix-website/.storybook`
- `.circleci/config.yml`
- `apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.md`
