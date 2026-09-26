/**
 * Site-wide content leak guards for published documentation bodies.
 */

const GITHUB_CONTENT =
  /https?:\/\/github\.com\/XpertMinds\/Jumentix\/(?:blob|tree)\b/i;
const GITHUB_ANY = /https?:\/\/github\.com\/XpertMinds\/Jumentix\b/i;

export function assertNoContentLeaks(markdown, sourceLabel) {
  if (GITHUB_CONTENT.test(markdown) || GITHUB_ANY.test(markdown)) {
    throw new Error(
      `Published docs leak GitHub content links (${sourceLabel}). `
      + 'Import or rewrite content onto in-site routes instead.'
    );
  }
}

/** Convert markdown links to Jumentix GitHub into plain labels (pre-sync sanitize). */
export function stripGitHubContentLinks(markdown) {
  return markdown.replace(
    /\[([^\]]+)\]\(https?:\/\/github\.com\/XpertMinds\/Jumentix[^)\s]*\)/gi,
    '$1'
  );
}

/**
 * Maintainer provenance tokens: Linear issue ids (bare, bracketed or linked),
 * requirement numbers and PR numbers. Contributor documentation under
 * `documentation/md/**` may cite them; the published developer site may not
 * (Requirement 066 audience matrix, Requirement 093 rule 4 — JUM-895).
 */
const ISSUE = String.raw`\[?JUM-\d+\]?(?:\([^)\s]*\))?`;
const REQUIREMENT = String.raw`(?:Requirements?|Requisitos?|Req\.?)\s*` + '`?\\d{3}`?' + String.raw`(?:\s*(?:§|rule|regra)\s*\d+)?`;
const PULL_REQUEST = String.raw`PR\s*#\d+`;
const TOKEN = new RegExp(`(?:${ISSUE}|${REQUIREMENT}|${PULL_REQUEST})`, 'g');
/** Words that may accompany provenance inside a parenthetical without carrying meaning. */
const CONNECTORS = /\b(?:and|e|or|ou|per|por|see|veja|landed|entregue|by|em|in|merged|mesclado|via|amended|emendado|from|de|do|da|pinned|fixado|issue|epic|épico|tracked|rastreado|pelo|pela|no|na)\b/gi;

function isProvenanceOnly(inner) {
  if (!new RegExp(TOKEN.source).test(inner)) return false;
  const rest = inner.replace(TOKEN, '').replace(CONNECTORS, '').replace(/[\s,;/…–—.:&+-]/g, '');
  return rest.length === 0;
}

/**
 * Remove maintainer provenance from a markdown body before publication:
 * parentheticals that only cite issues/requirements/PRs, and link reference
 * definitions pointing at Linear issues. Prose that cites provenance inline is
 * left intact so the documentation-audience gate reports it at its source.
 */
export function stripMaintainerProvenance(markdown) {
  const withoutDefinitions = markdown
    .replace(/^\[JUM-\d+\]:\s*\S+[^\n]*\n?/gm, '')
    // Unwrap issue links first so a parenthetical holding one has no nested parens.
    .replace(/\[(JUM-\d+)\]\([^)\s]*\)/g, '$1');
  return withoutDefinitions.replace(/[ \t]*\(([^()\n]|\n(?!\n))*?\)/g, (group) => {
    const inner = group.trim().slice(1, -1);
    return isProvenanceOnly(inner) ? '' : group;
  });
}
