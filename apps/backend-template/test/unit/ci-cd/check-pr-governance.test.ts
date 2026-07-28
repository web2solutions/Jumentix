/* eslint-disable @typescript-eslint/no-var-requires */
const prFs = require('fs');
const prOs = require('os');
const prPath = require('path');
const {
  REQUIRED_EPIC_FIELDS,
  TEMPLATE_PATHS,
  readField,
  validatePullRequest,
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

  it('rejects a template with missing focused epic fields', () => {
    expect.hasAssertions();
    const rootDir = prFs.mkdtempSync(prPath.join(prOs.tmpdir(), 'pr-governance-'));
    for (const templatePath of TEMPLATE_PATHS) {
      const absolutePath = prPath.join(rootDir, templatePath);
      prFs.mkdirSync(prPath.dirname(absolutePath), { recursive: true });
      prFs.writeFileSync(absolutePath, '- Focused epic link:\n');
    }

    const failures = validateTemplates(rootDir);
    expect(failures).toHaveLength(TEMPLATE_PATHS.length * (REQUIRED_EPIC_FIELDS.length - 1));
    prFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('accepts a task PR with matching branch, title, and structured metadata', () => {
    expect.hasAssertions();
    expect(validatePullRequest({
      title: '[CI] Enforce focused epic metadata',
      body: validBody,
      headRef: 'codex/ci/163-focused-epic-metadata',
      baseRef: 'dev'
    })).toStrictEqual([]);
    expect(readField(validBody, 'Epic-delegated agent ID')).toBe('codex-primary-001');
  });

  it('accepts bug tasks with the canonical branch and title prefix', () => {
    expect.hasAssertions();
    const bugBody = validBody
      .replace('Primary task nature: ci', 'Primary task nature: bug')
      .replace('JUM-163/focused-epic-metadata', 'JUM-183/codecov-artifact');

    expect(validatePullRequest({
      title: '[Bug] Preserve unit LCOV for Codecov (#183)',
      body: bugBody,
      headRef: 'codex/bug/183-codecov-artifact',
      baseRef: 'dev'
    })).toStrictEqual([]);
  });

  it('rejects task metadata links outside governed project trackers', () => {
    expect.hasAssertions();
    const invalidBody = validBody
      .replace(
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/overview',
        'https://example.com/projects/governance'
      )
      .replace(
        'https://linear.app/jumentix/issue/JUM-163/focused-epic-metadata',
        'https://example.com/issues/163'
      );

    expect(validatePullRequest({
      title: '[CI] Enforce focused epic metadata',
      body: invalidBody,
      headRef: 'codex/ci/163-focused-epic-metadata',
      baseRef: 'dev'
    })).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('focused epic link'),
      expect.stringContaining('child task issue link')
    ]));
  });

  it('fails closed for missing metadata and mismatched task nature', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[Feature] Wrong nature',
      body: '- Primary task nature: fix',
      headRef: 'codex/ci/163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('Focused epic link'),
      expect.stringContaining('Project Update'),
      expect.stringContaining('primary task nature must match branch nature'),
      expect.stringContaining('PR title prefix must match primary task nature')
    ]));
  });

  it('rejects a Project Update field that is not a Linear project update URL', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[CI] Enforce focused epic metadata',
      body: validBody.replace(
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/activity#project-update-7ef876cc-30c5-41ba-b2ea-fdca9935b0e3',
        'https://linear.app/jumentix/project/governance-foundation-c3cb6bae0771/activity'
      ),
      headRef: 'codex/ci/163-focused-epic-metadata',
      baseRef: 'dev'
    });

    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('Project Update')
    ]));
  });

  it('reports only the missing-field error when Project Update is empty', () => {
    expect.hasAssertions();
    const failures = validatePullRequest({
      title: '[CI] Enforce focused epic metadata',
      body: validBody.replace(/- Project Update:.*$/, ''),
      headRef: 'codex/ci/163-focused-epic-metadata',
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
      title: '[Release] Promote dev to main',
      headRef: 'dev',
      baseRef: 'main'
    })).toStrictEqual([]);
    expect(validatePullRequest({
      title: '[Fix] Direct task promotion',
      headRef: 'codex/fix/99-direct-main',
      baseRef: 'main'
    })).toHaveLength(2);
  });
});
