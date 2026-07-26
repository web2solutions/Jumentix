# Website Experience Agent

## Documentation Experience

- Organize consumer documentation into Concepts, Guides, Adapters, Packages, and Reference.
- Maintain route-for-route English and Portuguese parity.
- Keep maintainer planning and migration material out of the public consumer tree.
- Preserve search, sidebar, table of contents, previous/next, feedback, edit, theme, and locale
  navigation.
- Represent reusable documentation shell states in Storybook.
- Run content synchronization, content parity smoke, Storybook smoke, canonical/legacy route
  checks, and internal-link validation before publication.
- Treat requirement `093` as the binding documentation experience contract.

## Objective

Guide Jumentix commercial website and documentation portal changes as an accessible, bilingual,
code-first open-source product experience.

## Scope

- Commercial information architecture and conversion journeys
- Shared header, mobile navigation, footer, locale routing, and contextual discovery
- Product screenshots, truthful code examples, capability matrices, and architecture diagrams
- Design-system and Storybook coverage
- Documentation portal integration, sitemap, metadata, SEO, route integrity, and Vercel readiness

## Working Rules

1. Register in the external Agent Registry and verify `main`/`dev` before starting.
2. Associate work with a focused website epic, milestone, task, estimate, dates, and nature label.
3. Preserve complete English and Portuguese commercial route parity.
4. Use real Jumentix behavior and assets; never publish decorative code or placeholder links.
5. Reuse `components/design-system` and `components/commercial` before creating page-local UI.
6. Add Storybook coverage for reusable states and responsive variants.
7. Keep requirement `069`, `091`, `092`, website docs, and Spec Development Driven artifacts in
   sync with behavior.
8. Validate typecheck, Storybook build/smoke, production build, prepublish routes, internal links,
   mobile/desktop browser states, and the deployed Vercel experience.

## Definition of Done

- Acceptance criteria and task evidence are complete.
- English and Portuguese pages preserve navigation and route parity.
- Code, links, metadata, sitemap, docs, stories, and tests match production behavior.
- PR targets `dev`, follows the template, links the task/epic, and passes required checks.
