#!/usr/bin/env bun
/** Requirement 113 — zero-cost, repository-owned private CI. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

const circleciPath = path.join(root, '.circleci', 'config.yml');
const actionsDir = path.join(root, '.github', 'workflows');

if (!fs.existsSync(circleciPath)) {
  failures.push('Missing required CircleCI config: .circleci/config.yml');
} else {
  const contents = fs.readFileSync(circleciPath, 'utf8');
  const requiredMarkers = [
    /version:\s*2\.1/,
    /branch-gate:/,
    /workspace-builds:/,
    /workspace-tests:/,
    /integration:/,
    /coverage:/,
    /website:/,
    /third-party-review:/,
    /cimg\/node:22\./,
    /cypress\/browsers:node-22\..*-chrome-.*-ff-.*/,
    /redis:7\.2/,
    /rabbitmq:3\.13/,
    /bun install --frozen-lockfile/,
    /ci:gate:branch/,
    /JUMENTIX_CI_GATE_RESULT_FILE:\s*artifacts\/ci\/branch-quality-gate\.json/,
    /JUMENTIX_CI_MATRIX_RESULT_FILE:\s*artifacts\/ci\/full-test-matrix\.json/,
    /JUMENTIX_FULL_MATRIX_SKIP_CELLS:\s*workspace-builds,workspace-tests,website-prepublish,integration/,
    /bun run mono:build/,
    /bun run mono:test/,
    /bun run ci:integration/,
    /FIREBASE_SERVICE_ACCOUNT_KEY/,
    /test:coverage/,
    /coverage\/jest\/coverage-final\.json/,
    /coverage:check/,
    /coverage:patch/,
    /website:storybook:build/,
    /website:storybook:smoke/,
    /website:test:prepublish/,
    // JUM-396 — Cypress route/a11y gates are part of the website job contract.
    /website:test:cypress/,
    /gitleaks\.sarif/,
    /semgrep\.sarif/,
    /Enforce scanner outcomes/,
    /sonar-scanner/,
    /SONAR_TARGET_BRANCH="\$\{CIRCLE_PR_BASE_BRANCH:-\$\{CIRCLE_BRANCH:-\}\}"/,
    /Sonar runs for PRs or pushes targeting dev\/main/,
    /Report Sonar findings/,
    /Backfill git objects for Sonar SCM blame/,
    /git rev-list --objects --all/,
    /git cat-file --batch-check/,
    /--missing=print/,
    /Install verified Codecov CLI/,
    /Upload coverage to Codecov/,
    /codecov --verbose upload-process --disable-search --fail-on-error/,
    /CODECOV_TOKEN/,
    /store_artifacts/,
    /persist_to_workspace/,
    /JUMENTIX_PR_TITLE/,
    /JUMENTIX_PR_BODY/,
    /AAA_PR_TITLE/,
    /AAA_PR_BODY/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(contents)) failures.push(`.circleci/config.yml is missing ${String(marker)}`);
  }
  [
    /\n\s+- codecov:\s*\n/,
    /\n\s+- sonarqube:\s*\n/
  ].forEach((marker) => {
    if (marker.test(contents)) {
      failures.push(
        `Codecov and Sonar must run inside the coverage job, not as separate CircleCI jobs: ${String(marker)}`
      );
    }
  });
}

if (fs.existsSync(actionsDir)) {
  const workflows = fs.readdirSync(actionsDir).filter((file) => /\.ya?ml$/u.test(file));
  for (const workflow of workflows) {
    failures.push(`GitHub Actions workflow is disabled while billing is blocked: .github/workflows/${workflow}`);
  }
}

for (const retired of ['codecov.yml']) {
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
  'CI provider check passed: CircleCI covers branch gates, coverage, website validation, '
    + 'third-party review, and in-job Codecov/Sonar coverage publishing without GitHub Actions billing.'
);
