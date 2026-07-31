/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const INTEGRATION_CONTRACTS = Object.freeze([
  {
    file: 'sonar-project.properties',
    markers: [
      'sonar.organization=xpertminds',
      'sonar.projectKey=XpertMinds_Jumentix',
      'sonar.projectName=Jumentix',
      'sonar.javascript.lcov.reportPaths=./coverage/lcov.info'
    ]
  },
  {
    file: '.circleci/config.yml',
    markers: [
      'codecov/codecov@4.1.0',
      'install --frozen-lockfile',
      'commit_args: "--slug XpertMinds/Jumentix"',
      'report_args: "--slug XpertMinds/Jumentix"',
      'upload_args: "--slug XpertMinds/Jumentix --fail-on-error"',
      // Migrated from the retired GitHub Actions workflows (Requirement 105).
      // The provider changed; the canonical bindings did not.
      'AGENT_REGISTRY_TOKEN',
      'bun run ci:gate:branch',
      'sonar-scanner',
      'SONAR_TOKEN',
      'website:storybook:build'
    ]
  },
  {
    file: 'codecov.yml',
    markers: [
      'require_ci_to_pass: true',
      'target: 95%'
    ]
  },
  // `.snyk` was a required canonical integration until 2026-07-30 (JUM-540).
  //
  // Retired because Snyk cannot parse `bun.lock`: with no lockfile it recognises it
  // does not fail, it silently reads direct dependencies from package.json and
  // reports green. Measured at 45 dependencies against a resolved tree of 2027,
  // while every advisory `.snyk` suppressed was transitive — so the file was
  // documenting exceptions to a scan that was no longer happening.
  //
  // Replaced by the first-party OSV scanner: `bun run deps:audit`, wired into
  // ci:gate alongside `deps:check-scanner`, which fails closed if Snyk is ever
  // reintroduced without a lockfile it can read.
  {
    file: 'packages/security-scanner/src/index.js',
    markers: [
      'api.osv.dev',
      'ACCEPTED_RISK'
    ]
  },
  {
    file: '.github/dependabot.yml',
    markers: [
      'package-ecosystem: npm',
      'package-ecosystem: github-actions',
      'target-branch: dev'
    ]
  },
  {
    file: 'documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md',
    markers: [
      'XpertMinds/Jumentix',
      'CircleCI',
      'Codecov',
      'SonarQube Cloud',
      'Snyk',
      'GitGuardian',
      'Cursor Bugbot',
      'Vercel',
      'Dependabot'
    ]
  },
  {
    file: 'documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md',
    markers: [
      'XpertMinds/Jumentix',
      'CircleCI',
      'Codecov',
      'SonarQube Cloud',
      'Snyk',
      'GitGuardian',
      'Cursor Bugbot',
      'Vercel',
      'Dependabot'
    ]
  }
]);

function validateCanonicalIntegrations(rootDir = process.cwd()) {
  const failures = [];

  INTEGRATION_CONTRACTS.forEach(({ file, markers }) => {
    const absolutePath = path.join(rootDir, file);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`[integrations] missing required file: ${file}`);
      return;
    }

    const contents = fs.readFileSync(absolutePath, 'utf8');
    markers.forEach((marker) => {
      if (!contents.includes(marker)) {
        failures.push(`[integrations] ${file} is missing marker: ${marker}`);
      }
    });
  });

  return failures;
}

function run(rootDir = process.cwd()) {
  const failures = validateCanonicalIntegrations(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }

  console.log(
    `[integrations] canonical repository contracts passed `
    + `(${String(INTEGRATION_CONTRACTS.length)} files).`
  );
  return 0;
}

function runIfMain(
  mainModule = require.main,
  currentFilename = __filename,
  rootDir = process.cwd()
) {
  if (mainModule?.filename !== currentFilename) {
    return;
  }

  process.exitCode = run(rootDir);
}

runIfMain();

module.exports = {
  INTEGRATION_CONTRACTS,
  run,
  runIfMain,
  validateCanonicalIntegrations
};
