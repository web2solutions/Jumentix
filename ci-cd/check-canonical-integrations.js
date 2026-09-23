/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const INTEGRATION_CONTRACTS = Object.freeze([
  {
    file: 'sonar-project.properties',
    markers: [
      'sonar.organization=web2solutions',
      'sonar.projectKey=web2solutions_Jumentix',
      'sonar.projectName=Jumentix',
      'sonar.javascript.lcov.reportPaths=./coverage/lcov.info'
    ]
  },
  {
    file: '.github/workflows/ci.yml',
    markers: [
      'branch-gate',
      'bun run test:coverage',
      'bun run coverage:check',
      'bun run coverage:patch',
      'codecov/codecov-action@v5',
      'codecov/codecov-action@0fb7174895f61a3b6b78fc075e0cd60383518dac',
      'Upload coverage reports to Codecov',
      'third-party-review',
      'sonar-scanner'
    ]
  },
  // Dependency scanning is owned by the first-party OSV gate. It resolves the
  // installed Bun tree and fails closed on incomplete or unavailable results.
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
      'target-branch: dev'
    ]
  },
  {
    file: '.circleci/config.yml',
    markers: [
      'cimg/node:22',
      'branch-gate',
      'coverage',
      'codecov --verbose upload-process --disable-search --fail-on-error',
      'sonar-scanner -Dsonar.scm.disabled=true'
    ]
  },
  {
    file: 'documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md',
    markers: [
      'web2solutions/Jumentix',
      'repository-owned coverage',
      'CircleCI canonical',
      'GitHub Actions retained',
      'Codecov publishing',
      'SonarQube Cloud',
      'OSV.dev',
      'GitGuardian',
      'Cursor Bugbot',
      'Vercel',
      'Dependabot'
    ]
  },
  {
    file: 'documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md',
    markers: [
      'web2solutions/Jumentix',
      'GitHub Actions',
      'CircleCI canônico',
      'GitHub Actions retido',
      'Codecov',
      'SonarQube Cloud',
      'OSV.dev',
      'GitGuardian',
      'Cursor Bugbot',
      'Vercel',
      'Dependabot'
    ]
  }
]);

function validateCanonicalIntegrations(rootDir = process.cwd()) {
  const failures = [];

  ['codecov.yml'].forEach((file) => {
    if (fs.existsSync(path.join(rootDir, file))) {
      failures.push(`[integrations] retired provider contract is still present: ${file}`);
    }
  });

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
