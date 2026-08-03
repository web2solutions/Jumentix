#!/usr/bin/env bun
/** Requirement 113 — zero-cost, repository-owned private CI. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowsDir = path.join(root, '.github', 'workflows');
const failures = [];

const requiredWorkflows = Object.freeze({
  'test.yml': [
    /ci:gate:branch/,
    /bun install --frozen-lockfile/,
    /FIREBASE_SERVICE_ACCOUNT_KEY/
  ],
  'coverage.yml': [
    /test:coverage/,
    /coverage:check/,
    /coverage:patch/,
    /upload-artifact@[0-9a-f]{40}/,
    /timeout-minutes:/
  ],
  'website.yml': [
    /website:storybook:build/,
    /website:storybook:smoke/,
    /website:test:prepublish/
  ],
  'sonarqube-cloud.yml': [
    /test:coverage/,
    /coverage:check/,
    /sonarqube-scan-action@[0-9a-f]{40}/
  ]
});

for (const [file, markers] of Object.entries(requiredWorkflows)) {
  const absolute = path.join(workflowsDir, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required GitHub Actions workflow: .github/workflows/${file}`);
    continue;
  }
  const contents = fs.readFileSync(absolute, 'utf8');
  for (const marker of markers) {
    if (!marker.test(contents)) failures.push(`${file} is missing ${String(marker)}`);
  }
  if (!/permissions:\s*\n\s*contents:\s*read/.test(contents)) {
    failures.push(`${file} must declare read-only contents permission.`);
  }
  if (!/pull_request:/.test(contents)) {
    failures.push(`${file} must run for pull requests.`);
  }
}

for (const retired of ['codecov.yml']) {
  if (fs.existsSync(path.join(root, retired))) {
    failures.push(`${retired} is retired by Requirement 113 and must not remain authoritative.`);
  }
}

// Requirement 113 retires CircleCI — but its bridge amendment (owner decision,
// 2026-08-03) temporarily unretires it while the GitHub Actions allowance is
// quota-blocked, under one enforceable condition: the config must declare the
// bridge marker, so a silent permanent reintroduction still fails here. When
// the allowance is restored the config and the marker are removed together.
const circleCiConfig = path.join(root, '.circleci', 'config.yml');
if (fs.existsSync(circleCiConfig)) {
  const contents = fs.readFileSync(circleCiConfig, 'utf8');
  if (!/x-jumentix-temporary-bridge:/.test(contents)) {
    failures.push(
      '.circleci/config.yml is retired by Requirement 113 and may exist only as a '
      + 'declared temporary bridge (missing the `x-jumentix-temporary-bridge:` marker).'
    );
  }
}

if (failures.length > 0) {
  console.error('CI provider check failed (Requirement 113):\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const bridgeNote = fs.existsSync(circleCiConfig)
  ? ' CircleCI is present as a declared temporary bridge (Requirement 113).'
  : '';
console.log(
  'CI provider check passed: repository-owned GitHub workflows cover branch gates, '
    + `coverage, website validation, and Sonar defense-in-depth without retired providers.${bridgeNote}`
);
