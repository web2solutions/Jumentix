/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');
const { fetchIssueProject, readLinearKey } = require('./lib/linear.js');

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

function hasPullRequestMetadata({ title, body, headRef, baseRef }) {
  return Boolean(headRef || baseRef || title || body);
}

function isSignedDevPromotionBranch(headRef) {
  return /^codex\/release\/[A-Z0-9-]+-dev-main-signed-squash$/i.test(String(headRef || '').trim());
}

function validateReleasePullRequest({ title, headRef }) {
  const failures = [];
  if (headRef !== 'dev' && !isSignedDevPromotionBranch(headRef)) {
    failures.push('[pr-governance] only dev may target main');
  }
  if (!/^\[JUM-\d+\]\[Release\] .+/.test(title)) {
    failures.push(
      '[pr-governance] dev-to-main PR title must use [JUM-XXXX][Release] <concise outcome>'
    );
  }
  return failures;
}

function resolveTaskBranch(headRef, rootDir) {
  const failures = [];
  let branchPatterns;
  try {
    branchPatterns = agentBranchPatterns(rootDir);
  } catch (error) {
    return { failures: [error.message], branchMatch: null, branchNature: '' };
  }

  const branchMatch = headRef.match(branchPatterns.strict);
  const legacyAgentBranchMatch = headRef.match(branchPatterns.legacy);
  const branchNature = branchMatch?.[1] || legacyAgentBranchMatch?.[1] || '';
  if (!branchMatch && !legacyAgentBranchMatch) {
    failures.push(`[pr-governance] invalid task branch format: ${headRef || '<empty>'}`);
  }
  return { failures, branchMatch, branchNature };
}

function validateStructuredFields(body) {
  return REQUIRED_EPIC_FIELDS
    .filter((field) => isPlaceholder(readField(body, field)))
    .map((field) => `[pr-governance] missing structured PR field: ${field}`);
}

function validateTaskNature(body, branchNature) {
  const nature = readField(body, 'Primary task nature').toLowerCase();
  if (branchNature && nature !== branchNature) {
    return {
      nature,
      failures: [`[pr-governance] primary task nature must match branch nature (${branchNature})`]
    };
  }
  return { nature, failures: [] };
}

function taskIdentifierFromLink(taskLink) {
  return taskLink.match(
    /^https:\/\/linear\.app\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)\//
  )?.[1] || '';
}

function validateTaskTitle({ title, nature, taskIdentifier, branchMatch }) {
  const failures = [];
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
  if (branchMatch && taskIdentifier && branchMatch[2] !== taskIdentifier) {
    failures.push(
      `[pr-governance] branch task identifier (${branchMatch[2]}) must match ${taskIdentifier}`
    );
  }
  return failures;
}

function validateLinearLinks({ epicLink, taskLink, projectUpdateLink }) {
  const failures = [];
  if (epicLink && !LINEAR_PROJECT_URL_PATTERN.test(epicLink)) {
    failures.push('[pr-governance] focused epic link must be a Linear project URL');
  }
  if (taskLink && !LINEAR_ISSUE_URL_PATTERN.test(taskLink)) {
    failures.push('[pr-governance] child task issue link must be a Linear issue URL');
  }
  if (projectUpdateLink && !LINEAR_PROJECT_UPDATE_URL_PATTERN.test(projectUpdateLink)) {
    failures.push('[pr-governance] Project Update must be a Linear project update URL');
  }
  return failures;
}

function validatePullRequest(metadata, rootDir = process.cwd()) {
  const title = String(metadata.title || '').trim();
  const body = String(metadata.body || '');
  const headRef = String(metadata.headRef || '').trim();
  const baseRef = String(metadata.baseRef || '').trim();
  const failures = [];

  if (!hasPullRequestMetadata({ title, body, headRef, baseRef })) return failures;

  if (baseRef === 'main') {
    return validateReleasePullRequest({ title, headRef });
  }

  if (baseRef !== 'dev') {
    failures.push(`[pr-governance] task PR must target dev, got: ${baseRef || '<empty>'}`);
    return failures;
  }

  const { failures: branchFailures, branchMatch, branchNature } = resolveTaskBranch(headRef, rootDir);
  if (branchFailures.length > 0 && !branchMatch) return branchFailures;
  failures.push(...branchFailures, ...validateStructuredFields(body));

  const { nature, failures: natureFailures } = validateTaskNature(body, branchNature);
  failures.push(...natureFailures);

  const taskLink = readField(body, 'Child task issue link');
  const taskIdentifier = taskIdentifierFromLink(taskLink);
  failures.push(...validateTaskTitle({ title, nature, taskIdentifier, branchMatch }));

  const epicLink = readField(body, 'Focused epic link');
  const projectUpdateLink = readField(body, 'Project Update');
  failures.push(...validateLinearLinks({ epicLink, taskLink, projectUpdateLink }));

  return failures;
}

/** The `JUM-123` identifier inside a Linear issue URL, or null. */
function issueIdentifierFrom(issueLink) {
  const match = /\/issue\/([A-Z][A-Z0-9]*-\d+)(?:\/|$)/.exec(String(issueLink || ''));
  return match ? match[1] : null;
}

/** The project slug-id Linear puts at the end of a project URL, or null. */
function projectKeyFrom(projectLink) {
  const match = /\/project\/([^/?#]+)/.exec(String(projectLink || ''));
  if (!match) return null;
  const slug = match[1];
  const id = /-([0-9a-f]{8,})$/i.exec(slug);
  return id ? id[1].toLowerCase() : slug.toLowerCase();
}

/**
 * The child task issue is actually in the focused epic's project (JUM-627).
 *
 * Everything else in this file reads the PR body. Both link fields can be
 * well-formed, match each other's shape, name the right epic in prose — and
 * still describe an issue that belongs to no project at all. On 2026-08-07 five
 * issues shipped in exactly that state while this check passed on every one.
 * Requirement 090 is about delegation actually holding, not about the body
 * saying it does.
 *
 * `fetchProject` is injected so the rule is measurable without a network or a
 * credential; module substitution is not portable between Bun and Jest
 * (JUM-583), so the seam is a parameter.
 *
 * The credential is required, not optional. A membership check that skips
 * itself when `LINEAR_API_KEY` is unset would report success without doing its
 * work — the same false green this rule exists to remove.
 */
async function verifyIssueProjectMembership(metadata, options = {}) {
  const body = String(metadata.body || '');
  const epicLink = readField(body, 'Focused epic link');
  const taskLink = readField(body, 'Child task issue link');
  if (!epicLink || !taskLink) return [];

  const identifier = issueIdentifierFrom(taskLink);
  const expectedProject = projectKeyFrom(epicLink);
  if (!identifier || !expectedProject) return [];

  const apiKey = options.apiKey ?? readLinearKey(options.rootDir ?? process.cwd());
  if (!apiKey) {
    return [
      '[pr-governance] cannot verify that the child task issue belongs to the focused epic:'
        + ' no Linear credential. Set LINEAR_API_KEY in the CI environment.'
    ];
  }

  const fetchProject = options.fetchProject
    ?? ((key, id) => fetchIssueProject(key, id));

  let result;
  try {
    result = await fetchProject(apiKey, identifier);
  } catch (error) {
    // A lookup that could not run is not a pass. It says so, with the reason.
    return [
      `[pr-governance] could not resolve ${identifier} in Linear: ${
        error instanceof Error ? error.message : String(error)
      }`
    ];
  }

  if (!result?.found) {
    return [`[pr-governance] child task issue ${identifier} does not exist in Linear`];
  }
  if (!result.project) {
    return [
      `[pr-governance] child task issue ${identifier} belongs to no Linear project,`
        + ' so the focused epic link in this body is not a delegation that holds'
    ];
  }

  const actual = projectKeyFrom(result.project.url) ?? String(result.project.id || '').toLowerCase();
  const matches = actual === expectedProject
    || String(result.project.id || '').toLowerCase().startsWith(expectedProject);
  if (!matches) {
    return [
      `[pr-governance] child task issue ${identifier} belongs to "${result.project.name}",`
        + ' not to the project named in the focused epic link'
    ];
  }

  // Said out loud on success, so a green run is evidence rather than silence.
  // Without it the log cannot distinguish a lookup that confirmed membership
  // from one that never ran — which is the distinction this whole rule exists
  // to make.
  (options.log ?? console.log)(
    `[pr-governance] verified ${identifier} belongs to "${result.project.name}"`
  );
  return [];
}

function resolvePullRequestFlag(value = process.env.AAA_CI_IS_PULL_REQUEST) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return Boolean(process.env.CIRCLE_PULL_REQUEST);
}

async function run(options = {}) {
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

  // Only when the structural rules hold: with a malformed or missing link there
  // is nothing to look up, and a second complaint about the same field would
  // bury the one that says what to fix.
  if (shouldValidatePullRequest && failures.length === 0) {
    failures.push(...await verifyIssueProjectMembership(metadata, {
      rootDir: options.rootDir,
      apiKey: options.apiKey,
      fetchProject: options.fetchProject
    }));
  }

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }

  console.log('Pull request governance check passed.');
  return 0;
}

if (isEntryPoint(module)) {
  // Awaited, not fire-and-forget: an unawaited promise would let the process
  // exit 0 before the membership lookup resolved.
  run().then((code) => { process.exitCode = code; });
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
  issueIdentifierFrom,
  projectKeyFrom,
  readField,
  resolvePullRequestFlag,
  run,
  validatePullRequest,
  validateSupportedAgents,
  validateTemplates,
  verifyIssueProjectMembership
};
