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
    file: '.github/workflows/coverage.yml',
    markers: [
      'name: Repository-owned coverage',
      'bun run test:coverage',
      'bun run coverage:check',
      'bun run coverage:patch',
      'coverage/coverage-final.json'
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
      'package-ecosystem: github-actions',
      'target-branch: dev'
    ]
  },
  {
    file: 'documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md',
    markers: [
      'XpertMinds/Jumentix',
      'repository-owned coverage',
      'CircleCI retired',
      'Codecov retired',
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
      'XpertMinds/Jumentix',
      'CircleCI',
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

  // CircleCI is retired by Requirement 113 — except as a declared temporary
  // bridge while the GitHub Actions allowance is quota-blocked (the §3
  // condition). The marker is what keeps a silent permanent return failing
  // here; the bridge section and this allowance are removed together.
  const circleCiConfig = path.join(rootDir, '.circleci', 'config.yml');
  if (fs.existsSync(circleCiConfig)
    && !/x-jumentix-temporary-bridge:/.test(fs.readFileSync(circleCiConfig, 'utf8'))) {
    failures.push('[integrations] retired provider contract is still present: .circleci/config.yml');
  }

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
