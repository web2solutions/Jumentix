#!/usr/bin/env bun
/* Requirement 113 — deterministic third-party PR review contract. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contracts = [
  {
    file: '.github/workflows/third-party-review.yml',
    markers: [
      'name: third-party-review',
      'pull-requests: write',
      'gitleaks.sarif',
      'semgrep.sarif',
      'github-pr-review',
      'Enforce scanner outcomes',
      'sha256:65dcd4408adda7c183a6b4550cb1e9b19f7f627a6fbb7e0559bd466bedc44d7b'
    ]
  },
  {
    file: 'ci-cd/install-pinned-review-tools.sh',
    markers: ['v8.30.1', 'v0.21.0', 'sha256sum --check --status']
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

const workflow = fs.existsSync(path.join(root, contracts[0].file))
  ? fs.readFileSync(path.join(root, contracts[0].file), 'utf8') : '';
if (/uses:\s*[^\s]+@(v\d+|main|master)\b/.test(workflow)) {
  failures.push('third-party workflow contains a mutable action reference');
}
if (!/permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: write/.test(workflow)) {
  failures.push('third-party workflow permissions are broader or incomplete');
}

if (failures.length) {
  console.error('Third-party review contract failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Third-party review contract passed: pinned Gitleaks, Semgrep, and Reviewdog are fail-closed.');
