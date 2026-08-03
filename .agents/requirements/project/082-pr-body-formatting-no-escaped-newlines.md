# Requirement 082 - PR Body Formatting Without Escaped Newlines

## Context

PR descriptions with escaped newline tokens (`\n`) reduce readability and pollute review content.

## Requirement

1. When creating or updating PR descriptions, do not use escaped newline tokens (`\n`) as literal text formatting.
2. Use real line breaks and structured markdown sections instead.
3. Keep PR text clean, readable, and review-friendly.

## Acceptance Criteria

1. PR descriptions use native markdown breaklines/paragraphs.
2. No literal `\n` formatting tokens are used in PR body content.
3. Governance guidance references this formatting standard.
