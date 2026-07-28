# Requirement 077 - Multi-Agent Platform Support (Codex, Claude Code, Grok)

## Context

Jumentix must explicitly support multiple AI engineering agents used by maintainers and contributors, with aligned governance and execution expectations.

## Requirement

1. The repository must provide explicit instruction entry points for:
   - Codex
   - Claude Code
   - Grok
2. Agent guidance must be consistent with Jumentix governance, including:
   - Linear as task source of truth (Requirement `095`)
   - requirement/spec traceability
   - documentation sync obligations
   - CI/coverage quality gates
3. Multi-agent support must be represented in Spec Development Driven resources.

## Acceptance Criteria

1. Root-level agent instruction files exist for Codex, Claude Code, and Grok.
2. `.agents` requirement registry and NFR registry include this requirement.
3. Spec traceability documents map this requirement to governance resources and evidence.
