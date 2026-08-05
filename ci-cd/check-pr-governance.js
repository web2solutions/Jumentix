/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

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
  'Child task issue link',
  'Project Update'
]);
const REQUIRED_TITLE_FORMAT = '[JUM-XXXX][Nature] <concise outcome>';

const TITLE_PREFIX_BY_NATURE = Object.freeze({
  feature: '[Feature]',
  bug: '[Bug]',
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

const SUPPORTED_AGENTS_PATH = '.agents/supported-agents.json';
const SUPPORTED_AGENT_FIELDS = Object.freeze([
  'platformId',
  'branchPrefix',
  'displayName',
  'instructionsFile'
]);

const LINEAR_ISSUE_URL_PATTERN = /^https:\/\/linear\.app\/[^/]+\/issue\/[A-Z][A-Z0-9]*-\d+\/[^/?#]+$/;
const LINEAR_PROJECT_URL_PATTERN = /^https:\/\/linear\.app\/[^/]+\/project\/[^/?#]+(?:\/(?:overview|activity))?$/;
const LINEAR_PROJECT_UPDATE_URL_PATTERN = /^https:\/\/linear\.app\/[^/]+\/project\/[^/?#]+\/activity#project-update-[a-f0-9-]+$/i;

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

function loadSupportedAgents(rootDir = process.cwd()) {
  const declarationPath = path.join(rootDir, SUPPORTED_AGENTS_PATH);
  if (!fs.existsSync(declarationPath)) {
    throw new Error(
      `[pr-governance] missing supported agents declaration: ${SUPPORTED_AGENTS_PATH}`
    );
  }

  let agents;
  try {
    agents = JSON.parse(fs.readFileSync(declarationPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `[pr-governance] malformed supported agents declaration: ${SUPPORTED_AGENTS_PATH} (${error.message})`
    );
  }
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error(
      `[pr-governance] supported agents declaration must be a non-empty array: ${SUPPORTED_AGENTS_PATH}`
    );
  }
  for (const agent of agents) {
    const hasRequiredFields = agent !== null && typeof agent === 'object'
      && SUPPORTED_AGENT_FIELDS.every(
        (field) => typeof agent[field] === 'string' && agent[field].trim() !== ''
      );
    if (!hasRequiredFields) {
      throw new Error(
        '[pr-governance] supported agents declaration entries must define '
        + `${SUPPORTED_AGENT_FIELDS.join(', ')}: ${SUPPORTED_AGENTS_PATH}`
      );
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(agent.branchPrefix)) {
      throw new Error(
        `[pr-governance] invalid branch prefix "${agent.branchPrefix}" in ${SUPPORTED_AGENTS_PATH}`
      );
    }
  }
  return agents;
}

function agentBranchPatterns(rootDir = process.cwd()) {
  const alternation = loadSupportedAgents(rootDir)
    .map((agent) => agent.branchPrefix)
    .join('|');
  return {
    strict: new RegExp(`^(?:${alternation})\\/([a-z-]+)\\/([A-Z][A-Z0-9]*-\\d+)-[a-z0-9-]+$`),
    legacy: new RegExp(`^(?:${alternation})\\/([a-z-]+)\\/[a-z][a-z0-9-]*$`)
  };
}

function validateSupportedAgents(rootDir = process.cwd()) {
  let agents;
  try {
    agents = loadSupportedAgents(rootDir);
  } catch (error) {
    return [error.message];
  }

  return agents
    .filter((agent) => !fs.existsSync(path.join(rootDir, agent.instructionsFile)))
    .map(
      (agent) => `[pr-governance] declared agent "${agent.platformId}" is missing `
        + `instructions file: ${agent.instructionsFile}`
    );
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
    if (!contents.includes(REQUIRED_TITLE_FORMAT)) {
      failures.push(
        `[pr-governance] ${templatePath} is missing PR title format: ${REQUIRED_TITLE_FORMAT}`
      );
    }
  }
  return failures;
}

function validatePullRequest(metadata, rootDir = process.cwd()) {
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
    if (!/^\[JUM-\d+\]\[Release\] .+/.test(title)) {
      failures.push(
        '[pr-governance] dev-to-main PR title must use [JUM-XXXX][Release] <concise outcome>'
      );
    }
    return failures;
  }

  if (baseRef !== 'dev') {
    failures.push(`[pr-governance] task PR must target dev, got: ${baseRef || '<empty>'}`);
    return failures;
  }

  let branchPatterns;
  try {
    branchPatterns = agentBranchPatterns(rootDir);
  } catch (error) {
    failures.push(error.message);
    return failures;
  }

  const branchMatch = headRef.match(branchPatterns.strict);
  const legacyAgentBranchMatch = headRef.match(branchPatterns.legacy);
  const branchNature = branchMatch?.[1] || legacyAgentBranchMatch?.[1] || '';
  if (!branchMatch && !legacyAgentBranchMatch) {
    failures.push(`[pr-governance] invalid task branch format: ${headRef || '<empty>'}`);
  }

  for (const field of REQUIRED_EPIC_FIELDS) {
    const value = readField(body, field);
    if (isPlaceholder(value)) {
      failures.push(`[pr-governance] missing structured PR field: ${field}`);
    }
  }

  const nature = readField(body, 'Primary task nature').toLowerCase();
  if (branchNature && nature !== branchNature) {
    failures.push(`[pr-governance] primary task nature must match branch nature (${branchNature})`);
  }

  const taskLink = readField(body, 'Child task issue link');
  const taskIdentifier = taskLink.match(
    /^https:\/\/linear\.app\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)\//
  )?.[1] || '';
  const expectedPrefix = TITLE_PREFIX_BY_NATURE[nature];
  const expectedTitlePrefix = taskIdentifier && expectedPrefix
    ? `[${taskIdentifier}]${expectedPrefix} `
    : '';
  if (!expectedTitlePrefix || !title.startsWith(expectedTitlePrefix)) {
    failures.push(
      '[pr-governance] PR title must start with the matching '
      + `[JUM-XXXX][Nature] prefix (${expectedTitlePrefix.trim() || '<invalid metadata>'})`
    );
  }
  if (
    branchMatch
    && taskIdentifier
    && branchMatch[2] !== taskIdentifier
  ) {
    failures.push(
      `[pr-governance] branch task identifier (${branchMatch[2]}) must match ${taskIdentifier}`
    );
  }

  const epicLink = readField(body, 'Focused epic link');
  const projectUpdateLink = readField(body, 'Project Update');
  if (
    epicLink
    && !LINEAR_PROJECT_URL_PATTERN.test(epicLink)
  ) {
    failures.push('[pr-governance] focused epic link must be a Linear project URL');
  }
  if (
    taskLink
    && !LINEAR_ISSUE_URL_PATTERN.test(taskLink)
  ) {
    failures.push('[pr-governance] child task issue link must be a Linear issue URL');
  }
  if (projectUpdateLink && !LINEAR_PROJECT_UPDATE_URL_PATTERN.test(projectUpdateLink)) {
    failures.push('[pr-governance] Project Update must be a Linear project update URL');
  }

  return failures;
}

function resolvePullRequestFlag(value = process.env.AAA_CI_IS_PULL_REQUEST) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return Boolean(process.env.CIRCLE_PULL_REQUEST);
}

function run(options = {}) {
  const metadata = {
    title: options.title ?? process.env.JUMENTIX_PR_TITLE,
    body: options.body ?? process.env.JUMENTIX_PR_BODY,
    headRef: options.headRef ?? process.env.JUMENTIX_PR_HEAD_REF,
    baseRef: options.baseRef ?? process.env.JUMENTIX_PR_BASE_REF
  };
  const hasExplicitPullRequestMetadata = Boolean(
    String(metadata.title || '').trim()
    || String(metadata.body || '').trim()
    || String(metadata.baseRef || '').trim()
  );
  const shouldValidatePullRequest = resolvePullRequestFlag(options.isPullRequest)
    || hasExplicitPullRequestMetadata;
  const failures = [
    ...validateSupportedAgents(options.rootDir),
    ...validateTemplates(options.rootDir),
    ...(shouldValidatePullRequest ? validatePullRequest(metadata, options.rootDir) : [])
  ];

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }

  console.log('Pull request governance check passed.');
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = run();
}

module.exports = {
  REQUIRED_EPIC_FIELDS,
  REQUIRED_TITLE_FORMAT,
  SUPPORTED_AGENTS_PATH,
  SUPPORTED_AGENT_FIELDS,
  TEMPLATE_PATHS,
  TITLE_PREFIX_BY_NATURE,
  agentBranchPatterns,
  isPlaceholder,
  loadSupportedAgents,
  readField,
  resolvePullRequestFlag,
  run,
  validatePullRequest,
  validateSupportedAgents,
  validateTemplates
};
