#!/usr/bin/env bun
/**
 * Requirement 107 — CircleCI runs every branch alongside GitHub Actions.
 *
 * This check exists because the migration it enforces is exactly the kind that
 * regresses invisibly. A dropped job does not fail anything; it simply stops
 * running, and the pipeline stays green while covering less. So rather than
 * trusting that the CircleCI configuration is complete, this enumerates what
 * the retired GitHub Actions workflows did and asserts each is still present.
 *
 * Both providers run. An earlier revision retired GitHub Actions, written while
 * it could not execute at all; billing was resolved and the owner directed that
 * the workflows stay. What survives that reversal is the part that mattered:
 * CircleCI must cover the same checks and must run on every branch, so either
 * provider going dark degrades coverage instead of eliminating it.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowsDir = path.join(root, '.github', 'workflows');
const circleConfigPath = path.join(root, '.circleci', 'config.yml');

const failures = [];

/* ------------------------------------------------------------------ *
 * 1. Both providers must be configured
 * ------------------------------------------------------------------ */

const workflows = fs.existsSync(workflowsDir)
  ? fs.readdirSync(workflowsDir).filter((e) => e.endsWith('.yml') || e.endsWith('.yaml'))
  : [];

if (workflows.length === 0) {
  failures.push(
    'No GitHub Actions workflows under .github/workflows/.\n'
      + '  Requirement 107 keeps both providers. Removing one leaves the repository with a\n'
      + '  single point of failure — which is the state the billing outage created, and the\n'
      + '  reason this requirement was revised to keep both.'
  );
}

/* ------------------------------------------------------------------ *
 * 2. The CircleCI configuration must exist and mirror every Actions check
 * ------------------------------------------------------------------ */

if (!fs.existsSync(circleConfigPath)) {
  failures.push(
    'No .circleci/config.yml.\n'
      + '  Requirement 107 keeps both providers, so this leaves GitHub Actions as a single\n'
      + '  point of failure.'
  );
} else {
  const config = fs.readFileSync(circleConfigPath, 'utf8');

  // Each entry names a check the GitHub Actions workflows perform. A drift that
  // drops one is silent otherwise: nothing fails, the pipeline just covers less.
  const requiredChecks = [
    {
      what: 'the branch-aware quality gate (mirrors test.yml)',
      pattern: /ci:gate:branch/
    },
    {
      // `test:coverage`, not `test:unit`. Under Requirement 110 the runner is
      // `bun:test`, which emits no branch records, so coverage is produced by a
      // separate Jest run. Pointing Sonar at `test:unit` gave it no lcov at all
      // and it reported 0% coverage on new code.
      what: 'unit tests with coverage for the Sonar scan (mirrors sonarqube-cloud.yml)',
      pattern: /bun run test:coverage/
    },
    {
      what: 'the four-metric coverage threshold check (Requirement 110)',
      pattern: /coverage:check|check-coverage-thresholds/
    },
    {
      what: 'the SonarQube scan itself (mirrors sonarqube-cloud.yml)',
      pattern: /sonar-scanner/
    },
    {
      what: 'the Storybook build (mirrors website.yml)',
      pattern: /website:storybook:build/
    },
    {
      what: 'the Storybook inventory smoke test (mirrors website.yml)',
      pattern: /website:storybook:smoke/
    },
    {
      what: 'the publishable-content check (mirrors website.yml)',
      pattern: /website:test:prepublish/
    },
    {
      what: 'the pinned Bun toolchain assertion (Requirement 096)',
      pattern: /check-bun-version/
    },
    {
      what: 'a frozen install (Requirement 096 §2)',
      pattern: /bun install --frozen-lockfile/
    }
  ];

  for (const check of requiredChecks) {
    if (!check.pattern.test(config)) {
      failures.push(`CircleCI configuration is missing ${check.what}.`);
    }
  }

  // The gap this requirement exists to close: the previous
  // configuration filtered to dev and main, so no feature branch or pull request
  // ever produced a signal.
  const workflowSection = config.slice(config.indexOf('workflows:'));
  const qualityGateEntry = workflowSection.indexOf('- quality-gate');

  if (qualityGateEntry < 0) {
    failures.push(
      'No `quality-gate` job in the workflows section. It is the check that runs the\n'
        + '  branch gate, so without it a branch has no verification at all.'
    );
  } else {
    // A filter attached directly to the quality-gate entry restricts it. The
    // job must run everywhere (Requirement 107 §3).
    const entry = workflowSection.slice(
      qualityGateEntry,
      qualityGateEntry + '- quality-gate'.length + 200
    );
    const restrictedToLongLived = /filters:[\s\S]*branches:[\s\S]*only:/.test(entry)
      && /-\s*(dev|main)\b/.test(entry);

    if (restrictedToLongLived) {
      failures.push(
        'The quality-gate job is branch-filtered.\n'
          + '  Requirement 107 §3: CircleCI must run on every branch. Filtering to dev and\n'
          + '  main leaves every feature branch and pull request with no signal at the point\n'
          + '  a defect is cheapest to fix.'
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length > 0) {
  console.error('CI provider check failed (Requirement 107):\n');
  for (const failure of failures) {
    console.error(`- ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  'CI provider check passed: both providers configured, CircleCI covers every check '
    + 'and runs on every branch.'
);
