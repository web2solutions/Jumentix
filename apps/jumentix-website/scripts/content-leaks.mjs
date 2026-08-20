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
