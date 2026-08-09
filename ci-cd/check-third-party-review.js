#!/usr/bin/env bun
/* Requirement 113 — deterministic third-party PR review contract. */
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const contracts = [
  {
    file: '.github/workflows/ci.yml',
    markers: [
      'third-party-review:',
      'gitleaks.sarif',
      'semgrep.sarif',
      'Enforce scanner outcomes',
      'actions/upload-artifact@v7',
      '$HOME/review-tools/semgrep'
    ]
  },
  {
    file: 'ci-cd/install-pinned-review-tools.sh',
    markers: ['v8.30.1', 'semgrep==1.172.0', 'checksum mismatch']
  },
  {
    file: '.semgrep.yml',
    markers: ['CWE-95', 'CWE-78', 'severity: ERROR']
  }
];

const failures = [];
for (const contract of contracts) {
  const absolute = path.join(root, contract.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`missing ${contract.file}`);
    continue;
  }
  const contents = fs.readFileSync(absolute, 'utf8');
  for (const marker of contract.markers) {
    if (!contents.includes(marker)) failures.push(`${contract.file} is missing ${marker}`);
  }
}

/**
 * The structural half of the contract, read from the parsed job (JUM-616).
 *
 * These two rules used to match the raw text of the whole file. Both bounds
 * were wrong. Too broad: a comment in an unrelated job explaining why it does
 * *not* use the remote-docker step failed the check that forbids using it — so
 * the cheapest response was to delete the explanation, which is backwards for a
 * governance check. Too narrow: any job could have used the step as long as the
 * word never appeared, and a `docker run` assembled from a variable would have
 * passed.
 *
 * Parsing answers what the failure message already claims to assert: what the
 * `third-party-review` job does. Comments cannot affect it, and the rule stops
 * constraining jobs it was never about.
 */
function reviewJobFailures(configText) {
  const problems = [];

  let config;
  try {
    config = YAML.parse(configText);
  } catch (error) {
    return [`.github/workflows/ci.yml is not parseable YAML: ${error.message}`];
  }

  const job = config?.jobs?.['third-party-review'];
  if (!job) {
    // Fail closed. A missing job is not an absent violation; it means the
    // contract this check exists to hold is not being run at all.
    return ['.github/workflows/ci.yml declares no "third-party-review" job'];
  }

  const steps = Array.isArray(job.steps) ? job.steps : [];
  const stepNames = steps.map((step) => (typeof step === 'string' ? step : Object.keys(step || {})[0]));

  if (stepNames.includes('setup_remote_docker')) {
    problems.push(
      'third-party GitHub Actions job must run native pinned scanners without remote Docker workspace mounts'
    );
  }

  // Every shell fragment the job runs, wherever it is nested.
  const commands = steps
    .filter((step) => step && typeof step === 'object' && step.run)
    .map((step) => (typeof step.run === 'string' ? step.run : String(step.run.command || '')));

  if (commands.some((command) => /\bdocker\s+run\b/.test(command))) {
    problems.push(
      'third-party GitHub Actions job must run native pinned scanners without remote Docker workspace mounts'
    );
  }

  if (commands.some((command) => /\buses:\s*\S+@(v\d+|main|master)\b/.test(command))) {
    problems.push('third-party GitHub Actions job contains a mutable action reference');
  }

  return problems;
}

const workflow = fs.existsSync(path.join(root, contracts[0].file))
  ? fs.readFileSync(path.join(root, contracts[0].file), 'utf8') : '';
failures.push(...reviewJobFailures(workflow));

if (failures.length) {
  console.error('Third-party review contract failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Third-party review contract passed: pinned Gitleaks and native Semgrep are fail-closed in GitHub Actions.');
