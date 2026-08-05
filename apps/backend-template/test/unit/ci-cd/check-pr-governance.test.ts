/* eslint-disable @typescript-eslint/no-var-requires */
const prFs = require('fs');
const prOs = require('os');
const prPath = require('path');
const {
  REQUIRED_EPIC_FIELDS,
  REQUIRED_TITLE_FORMAT,
  SUPPORTED_AGENTS_PATH,
  TEMPLATE_PATHS,
  readField,
  validatePullRequest,
  validateSupportedAgents,
  validateTemplates
} = require('../../../../../ci-cd/check-pr-governance');

const validBody = [
  '- Focused epic link: https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/overview',
  '- Epic milestone: Governance foundation - 2026-08-08',
  '- Primary task nature: ci',
  '- Epic-delegated agent ID: codex-primary-001',
  '- Child task issue link: https://linear.app/jumentix/issue/JUM-163/focused-epic-metadata',
  '- Project Update: https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/activity#project-update-7ef876cc-30c5-41ba-b2ea-fdca9935b0e3'
].join('\n');

describe('check-pr-governance', () => {
  it('keeps every PR template aligned with focused epic metadata', () => {
    expect.hasAssertions();
    expect(validateTemplates()).toStrictEqual([]);
  });

  it('keeps every declared agent instructions file present', () => {
    expect.hasAssertions();
    expect(validateSupportedAgents()).toStrictEqual([]);
  });

  it('rejects a template with missing focused epic fields', () => {
    expect.hasAssertions();
    const rootDir = prFs.mkdtempSync(prPath.join(prOs.tmpdir(), 'pr-governance-'));
    for (const templatePath of TEMPLATE_PATHS) {
      const absolutePath = prPath.join(rootDir, templatePath);
      prFs.mkdirSync(prPath.dirname(absolutePath), { recursive: true });
      prFs.writeFileSync(
        absolutePath,
        `- Focused epic link:\n- Required PR title format: ${REQUIRED_TITLE_FORMAT}\n`
      );
    }

    const failures = validateTemplates(rootDir);
    expect(failures).toHaveLength(TEMPLATE_PATHS.length * (REQUIRED_EPIC_FIELDS.length - 1));
    prFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('accepts a task PR with matching branch, title, and structured metadata', () => {
    expect.hasAssertions();
    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    })).toStrictEqual([]);
    expect(readField(validBody, 'Epic-delegated agent ID')).toBe('codex-primary-001');
  });

  it('accepts a legacy agent branch when Linear task metadata is structured', () => {
    expect.hasAssertions();
    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/focused-epic-metadata',
      baseRef: 'dev'
    })).toStrictEqual([]);
  });

  it('accepts bug tasks with the canonical branch and title prefix', () => {
    expect.hasAssertions();
    const bugBody = validBody
      .replace('Primary task nature: ci', 'Primary task nature: bug')
      .replace('JUM-163/focused-epic-metadata', 'JUM-183/codecov-artifact');

    expect(validatePullRequest({
      title: '[JUM-183][Bug] Preserve unit LCOV for Codecov',
      body: bugBody,
      headRef: 'codex/bug/JUM-183-codecov-artifact',
      baseRef: 'dev'
    })).toStrictEqual([]);
  });

  it('rejects task metadata links outside Linear', () => {
    expect.hasAssertions();
    const invalidBody = validBody
      .replace(
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/overview',
        'https://github.com/XpertMinds/Jumentix/issues/500'
      )
      .replace(
        'https://linear.app/jumentix/issue/JUM-163/focused-epic-metadata',
        'https://github.com/XpertMinds/Jumentix/issues/501'
      );

    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: invalidBody,
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    })).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('focused epic link'),
      expect.stringContaining('child task issue link')
    ]));
  });

  it('fails closed for missing metadata and mismatched task nature', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-163][Feature] Wrong nature',
      body: '- Primary task nature: fix',
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('Focused epic link'),
      expect.stringContaining('Project Update'),
      expect.stringContaining('primary task nature must match branch nature'),
      expect.stringContaining('[JUM-XXXX][Nature]')
    ]));
  });

  it('rejects a Project Update field that is not a Linear project update URL', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody.replace(
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/activity#project-update-7ef876cc-30c5-41ba-b2ea-fdca9935b0e3',
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/activity'
      ),
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('Project Update')
    ]));
  });

  it('reports only the missing-field error when Project Update is empty', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody.replace(/- Project Update:.*$/, ''),
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('missing structured PR field: Project Update')
    ]));
    expect(failures).not.toStrictEqual(expect.arrayContaining([
      expect.stringContaining('Project Update must be a Linear project update URL')
    ]));
  });

  it('allows only a release PR from dev to target main', () => {
    expect.hasAssertions();
    expect(validatePullRequest({
      title: '[JUM-163][Release] Promote dev to main',
      headRef: 'dev',
      baseRef: 'main'
    })).toStrictEqual([]);
    expect(validatePullRequest({
      title: '[JUM-99][Fix] Direct task promotion',
      headRef: 'codex/fix/JUM-99-direct-main',
      baseRef: 'main'
    })).toHaveLength(2);
  });

  it('rejects a title or branch whose task identifier differs from the Linear Issue', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-999][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/JUM-999-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('[JUM-163][CI]'),
      expect.stringContaining('branch task identifier (JUM-999) must match JUM-163')
    ]));
  });

  it('rejects a numeric-only legacy branch identifier', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toContain(
      '[pr-governance] invalid task branch format: codex/ci/163-focused-epic-metadata'
    );
  });

  it('accepts a kimi task branch declared in the supported agents file', () => {
    expect.hasAssertions();
    const kimiBody = validBody
      .replace('Primary task nature: ci', 'Primary task nature: governance')
      .replace('JUM-163/focused-epic-metadata', 'JUM-604/declarative-agent-support');

    expect(validatePullRequest({
      title: '[JUM-604][Governance] Declare supported agents as data',
      body: kimiBody,
      headRef: 'kimi/governance/JUM-604-declarative-agent-support',
      baseRef: 'dev'
    })).toStrictEqual([]);
  });

  it('rejects a branch prefix absent from the supported agents declaration', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'cursor/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toContain(
      '[pr-governance] invalid task branch format: cursor/ci/JUM-163-focused-epic-metadata'
    );
  });

  it('derives branch prefixes from the supported agents declaration', () => {
    expect.hasAssertions();
    const rootDir = prFs.mkdtempSync(prPath.join(prOs.tmpdir(), 'pr-governance-'));
    prFs.mkdirSync(prPath.join(rootDir, '.agents'), { recursive: true });
    prFs.writeFileSync(
      prPath.join(rootDir, SUPPORTED_AGENTS_PATH),
      JSON.stringify([{
        platformId: 'kimi',
        branchPrefix: 'kimi',
        displayName: 'Kimi Code CLI',
        instructionsFile: 'KIMI.md'
      }])
    );

    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    }, rootDir)).toStrictEqual([
      '[pr-governance] invalid task branch format: codex/ci/JUM-163-focused-epic-metadata'
    ]);
    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'kimi/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    }, rootDir)).toStrictEqual([]);
    prFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('fails the gate when a declared agent instructions file is missing', () => {
    expect.hasAssertions();
    const rootDir = prFs.mkdtempSync(prPath.join(prOs.tmpdir(), 'pr-governance-'));
    prFs.mkdirSync(prPath.join(rootDir, '.agents'), { recursive: true });
    prFs.writeFileSync(
      prPath.join(rootDir, SUPPORTED_AGENTS_PATH),
      JSON.stringify([{
        platformId: 'kimi',
        branchPrefix: 'kimi',
        displayName: 'Kimi Code CLI',
        instructionsFile: 'KIMI.md'
      }])
    );

    expect(validateSupportedAgents(rootDir)).toStrictEqual([
      '[pr-governance] declared agent "kimi" is missing instructions file: KIMI.md'
    ]);
    prFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('fails closed when the supported agents declaration is missing or malformed', () => {
    expect.hasAssertions();
    const rootDir = prFs.mkdtempSync(prPath.join(prOs.tmpdir(), 'pr-governance-'));

    expect(validateSupportedAgents(rootDir)).toStrictEqual([
      `[pr-governance] missing supported agents declaration: ${SUPPORTED_AGENTS_PATH}`
    ]);
    expect(validatePullRequest({
      title: '[JUM-163][CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'kimi/ci/JUM-163-focused-epic-metadata',
      baseRef: 'dev'
    }, rootDir)).toStrictEqual([
      `[pr-governance] missing supported agents declaration: ${SUPPORTED_AGENTS_PATH}`
    ]);

    prFs.mkdirSync(prPath.join(rootDir, '.agents'), { recursive: true });
    prFs.writeFileSync(prPath.join(rootDir, SUPPORTED_AGENTS_PATH), '{not json');
    expect(validateSupportedAgents(rootDir)[0]).toContain(
      'malformed supported agents declaration'
    );
    prFs.rmSync(rootDir, { recursive: true, force: true });
  });
});
