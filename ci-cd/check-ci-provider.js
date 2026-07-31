#!/usr/bin/env bun
/**
 * Requirement 105 — CircleCI is the sole CI provider.
 *
 * This check exists because the migration it enforces is exactly the kind that
 * regresses invisibly. A dropped job does not fail anything; it simply stops
 * running, and the pipeline stays green while covering less. So rather than
 * trusting that the CircleCI configuration is complete, this enumerates what
 * the retired GitHub Actions workflows did and asserts each is still present.
 *
 * It also enforces the reason the migration happened. GitHub Actions became
 * unable to execute at all — every run terminated at the runner on billing —
 * which under Requirement 065 left every required check permanently pending and
 * blocked every merge. Reintroducing a workflow file would recreate that.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowsDir = path.join(root, '.github', 'workflows');
const circleConfigPath = path.join(root, '.circleci', 'config.yml');

const failures = [];

/* ------------------------------------------------------------------ *
 * 1. No GitHub Actions workflow may act as a required check
 * ------------------------------------------------------------------ */

if (fs.existsSync(workflowsDir)) {
  const workflows = fs
    .readdirSync(workflowsDir)
    .filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'));

  if (workflows.length > 0) {
    failures.push(
      `GitHub Actions workflows still present: ${workflows.join(', ')}.\n`
        + '  Requirement 105 retires GitHub Actions entirely. Remove the files rather than\n'
        + '  disabling them — a disabled workflow is a file someone re-enables later without\n'
        + '  knowing why it was off. Move the check into .circleci/config.yml.'
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. The CircleCI configuration must exist and cover every retired check
 * ------------------------------------------------------------------ */

if (!fs.existsSync(circleConfigPath)) {
  failures.push(
    'No .circleci/config.yml. CircleCI is the sole provider (Requirement 105), so its\n'
      + '  absence means the repository has no CI at all.'
  );
} else {
  const config = fs.readFileSync(circleConfigPath, 'utf8');

  // Each entry names a check the retired workflows performed. A migration that
  // drops one is silent otherwise: nothing fails, the pipeline just covers less.
  const requiredChecks = [
    {
      what: 'the branch-aware quality gate (was test.yml)',
      pattern: /ci:gate:branch/
    },
    {
      what: 'unit tests with coverage for the Sonar scan (was sonarqube-cloud.yml)',
      pattern: /bun run test:unit/
    },
    {
      what: 'the SonarQube scan itself (was sonarqube-cloud.yml)',
      pattern: /sonar-scanner/
    },
    {
      what: 'the Storybook build (was website.yml)',
      pattern: /website:storybook:build/
    },
    {
      what: 'the Storybook inventory smoke test (was website.yml)',
      pattern: /website:storybook:smoke/
    },
    {
      what: 'the publishable-content check (was website.yml)',
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

  // The gap that made this migration necessary in the first place: the previous
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
    // job must run everywhere (Requirement 105 §3).
    const entry = workflowSection.slice(
      qualityGateEntry,
      qualityGateEntry + '- quality-gate'.length + 200
    );
    const restrictedToLongLived = /filters:[\s\S]*branches:[\s\S]*only:/.test(entry)
      && /-\s*(dev|main)\b/.test(entry);

    if (restrictedToLongLived) {
      failures.push(
        'The quality-gate job is branch-filtered.\n'
          + '  Requirement 105 §3: CircleCI must run on every branch. Filtering to dev and\n'
          + '  main leaves every feature branch and pull request with no signal at the point\n'
          + '  a defect is cheapest to fix — which is the state this migration corrected.'
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length > 0) {
  console.error('CI provider check failed (Requirement 105):\n');
  for (const failure of failures) {
    console.error(`- ${failure}\n`);
  }
  process.exit(1);
}

console.log('CI provider check passed: CircleCI is the sole provider and covers every retired check.');
