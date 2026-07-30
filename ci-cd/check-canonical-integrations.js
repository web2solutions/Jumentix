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
    file: '.github/workflows/sonarqube-cloud.yml',
    markers: [
      'pull_request:\n    branches: ["main", "dev"]',
      'Verify Sonar token',
      'test -n "$SONAR_TOKEN"',
      'SonarSource/sonarqube-scan-action@'
    ]
  },
  {
    file: '.github/workflows/test.yml',
    markers: [
      'GH_TOKEN: ${{ secrets.AGENT_REGISTRY_TOKEN }}',
      'bun install --frozen-lockfile',
      'bun run ci:gate:branch'
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
      'only:\n                - dev\n                - main'
    ]
  },
  {
    file: 'codecov.yml',
    markers: [
      'require_ci_to_pass: true',
      'target: 95%'
    ]
  },
  {
    file: '.snyk',
    markers: [
      'version: v1.25.0'
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
