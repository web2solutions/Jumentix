/* eslint-disable no-console */
const LONG_LIVED_BRANCHES = new Set(['dev', 'main']);
const ATTEMPTS = 20;
const RETRY_DELAY_MS = 15_000;
const { isEntryPoint } = require('./lib/entry-point.js');

function reportUrls(branch) {
  const base = `https://codecov.io/gh/web2solutions/Jumentix/branch/${encodeURIComponent(branch)}`;
  return [`${base}/graph/badge.svg`, `${base}/graphs/tree.svg`];
}

async function verifyCodecovReports({
  branch = process.env.CODECOV_BRANCH,
  fetchFn = fetch,
  attempts = ATTEMPTS,
  delay = (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    })
} = {}) {
  if (!LONG_LIVED_BRANCHES.has(branch)) {
    console.log(
      `[codecov] skipping public report verification for ${branch || 'an unspecified branch'}.`
    );
    return;
  }

  for (const url of reportUrls(branch)) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop -- polling: each attempt must finish before the next one starts
      const response = await fetchFn(url, { redirect: 'follow' });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && /^image\/svg\+xml(?:;|$)/i.test(contentType)) {
        console.log(`[codecov] verified ${url}`);
        break;
      }
      if (attempt === attempts) {
        throw new Error(
          `Codecov did not publish an SVG report for ${branch}: ${url} (${response.status} ${contentType}).`
        );
      }
      // eslint-disable-next-line no-await-in-loop -- polling: the backoff delay must elapse before the next attempt
      await delay(RETRY_DELAY_MS);
    }
  }
}

if (isEntryPoint(module)) {
  verifyCodecovReports().catch((error) => {
    console.error(`[codecov] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ATTEMPTS,
  LONG_LIVED_BRANCHES,
  reportUrls,
  RETRY_DELAY_MS,
  verifyCodecovReports
};
