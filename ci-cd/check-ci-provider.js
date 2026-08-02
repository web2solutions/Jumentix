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
    /AGENT_REGISTRY_TOKEN/
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

for (const retired of ['.circleci/config.yml', 'codecov.yml']) {
  if (fs.existsSync(path.join(root, retired))) {
    failures.push(`${retired} is retired by Requirement 113 and must not remain authoritative.`);
  }
}

if (failures.length > 0) {
  console.error('CI provider check failed (Requirement 113):\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'CI provider check passed: repository-owned GitHub workflows cover branch gates, '
    + 'coverage, website validation, and Sonar defense-in-depth without CircleCI or Codecov.'
);
