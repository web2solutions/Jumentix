/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATHS = Object.freeze([
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE/feature.md',
  '.github/PULL_REQUEST_TEMPLATE/bugfix.md',
  '.github/PULL_REQUEST_TEMPLATE/security.md',
  '.github/PULL_REQUEST_TEMPLATE/governance.md'
]);

const REQUIRED_EPIC_FIELDS = Object.freeze([
  'Focused epic link',
  'Epic milestone',
  'Primary task nature',
  'Epic-delegated agent ID',
  'Child task issue link'
]);

const TITLE_PREFIX_BY_NATURE = Object.freeze({
  feature: '[Feature]',
  fix: '[Fix]',
  security: '[Security]',
  governance: '[Governance]',
  docs: '[Docs]',
  refactor: '[Refactor]',
  test: '[Test]',
  ci: '[CI]',
  release: '[Release]',
  chore: '[Chore]'
});

function readField(body, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body || '').match(new RegExp(`^- ${escaped}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim().replace(/^`|`$/g, '') : '';
}

function isPlaceholder(value) {
  const normalized = String(value || '').trim();
  return !normalized
    || /^<.*>$/.test(normalized)
    || /^(n\/a|none|todo|tbd|-+)$/i.test(normalized);
}

function validateTemplates(rootDir = process.cwd()) {
  const failures = [];
  for (const templatePath of TEMPLATE_PATHS) {
    const absolutePath = path.join(rootDir, templatePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`[pr-governance] missing PR template: ${templatePath}`);
      continue;
    }

    const contents = fs.readFileSync(absolutePath, 'utf8');
    for (const field of REQUIRED_EPIC_FIELDS) {
      if (!contents.includes(`- ${field}:`)) {
        failures.push(`[pr-governance] ${templatePath} is missing field: ${field}`);
      }
    }
  }
  return failures;
}

function validatePullRequest(metadata) {
  const title = String(metadata.title || '').trim();
  const body = String(metadata.body || '');
  const headRef = String(metadata.headRef || '').trim();
  const baseRef = String(metadata.baseRef || '').trim();
  const failures = [];

  if (!headRef && !baseRef && !title && !body) return failures;

  if (baseRef === 'main') {
    if (headRef !== 'dev') {
      failures.push('[pr-governance] only dev may target main');
    }
    if (!title.startsWith('[Release] ')) {
      failures.push('[pr-governance] dev-to-main PR title must start with [Release]');
    }
    return failures;
  }

  if (baseRef !== 'dev') {
    failures.push(`[pr-governance] task PR must target dev, got: ${baseRef || '<empty>'}`);
    return failures;
  }

  const branchMatch = headRef.match(/^(?:codex|claude|grok)\/([a-z-]+)\/(\d+)-[a-z0-9-]+$/);
  if (!branchMatch) {
    failures.push(`[pr-governance] invalid task branch format: ${headRef || '<empty>'}`);
  }

  for (const field of REQUIRED_EPIC_FIELDS) {
    const value = readField(body, field);
    if (isPlaceholder(value)) {
      failures.push(`[pr-governance] missing structured PR field: ${field}`);
    }
  }

  const nature = readField(body, 'Primary task nature').toLowerCase();
  if (branchMatch && nature !== branchMatch[1]) {
    failures.push(`[pr-governance] primary task nature must match branch nature (${branchMatch[1]})`);
  }

  const expectedPrefix = TITLE_PREFIX_BY_NATURE[nature];
  if (!expectedPrefix || !title.startsWith(`${expectedPrefix} `)) {
    failures.push(`[pr-governance] PR title prefix must match primary task nature (${nature || '<empty>'})`);
  }

  const epicLink = readField(body, 'Focused epic link');
  const taskLink = readField(body, 'Child task issue link');
  if (epicLink && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(epicLink)) {
    failures.push('[pr-governance] focused epic link must be a GitHub issue URL');
  }
  if (taskLink && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(taskLink)) {
    failures.push('[pr-governance] child task issue link must be a GitHub issue URL');
  }

  return failures;
}

function run(options = {}) {
  const failures = [
    ...validateTemplates(options.rootDir),
    ...validatePullRequest({
      title: options.title ?? process.env.AAA_PR_TITLE,
      body: options.body ?? process.env.AAA_PR_BODY,
      headRef: options.headRef ?? process.env.AAA_PR_HEAD_REF,
      baseRef: options.baseRef ?? process.env.AAA_PR_BASE_REF
    })
  ];

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }

  console.log('Pull request governance check passed.');
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  REQUIRED_EPIC_FIELDS,
  TEMPLATE_PATHS,
  TITLE_PREFIX_BY_NATURE,
  isPlaceholder,
  readField,
  run,
  validatePullRequest,
  validateTemplates
};
