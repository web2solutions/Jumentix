#!/usr/bin/env bun
/* Requirement 113 — deterministic third-party PR review contract. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contracts = [
  {
    file: '.circleci/config.yml',
    markers: [
      'third-party-review:',
      'gitleaks.sarif',
      'semgrep.sarif',
      'Enforce scanner outcomes',
      'store_artifacts',
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

const circleci = fs.existsSync(path.join(root, contracts[0].file))
  ? fs.readFileSync(path.join(root, contracts[0].file), 'utf8') : '';
if (/uses:\s*[^\s]+@(v\d+|main|master)\b/.test(circleci)) {
  failures.push('third-party CircleCI job contains a mutable action reference');
}
if (/setup_remote_docker/.test(circleci) || /docker run/.test(circleci)) {
  failures.push('third-party CircleCI job must run native pinned scanners without remote Docker workspace mounts');
}

if (failures.length) {
  console.error('Third-party review contract failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Third-party review contract passed: pinned Gitleaks and native Semgrep are fail-closed in CircleCI.');
