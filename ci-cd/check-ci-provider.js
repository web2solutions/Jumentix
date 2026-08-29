#!/usr/bin/env bun
/** Requirement 113 — zero-cost, repository-owned private CI. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

const circleciPath = path.join(root, '.circleci', 'config.yml');
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
const packagePath = path.join(root, 'package.json');

if (fs.existsSync(circleciPath)) {
  failures.push('CircleCI is disabled by Requirement 113: remove .circleci/config.yml');
}

if (!fs.existsSync(workflowPath)) {
  failures.push('Missing required GitHub Actions workflow: .github/workflows/ci.yml');
} else {
  const contents = fs.readFileSync(workflowPath, 'utf8');
  const servicesPath = path.join(root, 'ci-cd', 'ensure-local-ci-services.sh');
  const dockerRuntimePath = path.join(root, 'ci-cd', 'ensure-docker-runtime.sh');
  const serviceContents = fs.existsSync(servicesPath) ? fs.readFileSync(servicesPath, 'utf8') : '';
  const dockerRuntimeContents = fs.existsSync(dockerRuntimePath) ? fs.readFileSync(dockerRuntimePath, 'utf8') : '';
  const packageContents = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
  const ciContents = `${contents}\n${serviceContents}\n${dockerRuntimeContents}\n${packageContents}`;
  const requiredMarkers = [
    /name:\s*CI/,
    /pull_request:/,
    /workflow_dispatch:/,
    /schedule:/,
    /runs-on:\s*\[self-hosted,\s*jumentix\]/,
    /Checkout repository without JavaScript Actions/,
    /https:\/\/x-access-token:\$\{GITHUB_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git/,
    /git -c credential\.helper= fetch --no-tags --prune origin/,
    /Use local Node\.js 22/,
    /node --version \| grep -E '\^v22\\\.'/,
    /branch-gate:/,
    /third-party-review:/,
    /workspace-builds:/,
    /workspace-tests:/,
    /integration:/,
    /coverage:/,
    /Fetch branch references for patch coverage/,
    /website:/,
    /database-matrix:/,
    /classify-ci-context\.js --result-file artifacts\/ci\/ci-context\.json --require-job branch-gate/,
    /bun run ci:gate:branch/,
    /JUMENTIX_CI_GATE_RESULT_FILE:\s*artifacts\/ci\/branch-quality-gate\.json/,
    /JUMENTIX_CI_MATRIX_RESULT_FILE:\s*artifacts\/ci\/full-test-matrix\.json/,
    /JUMENTIX_FULL_MATRIX_SKIP_CELLS:\s*workspace-builds,workspace-tests,website-prepublish,integration/,
    /JUMENTIX_PR_BASE_REF=\$\{GITHUB_BASE_REF\}/,
    /AAA_PR_BODY<<__JUMENTIX_BODY__/,
    /redis:7\.2-alpine/,
    /rabbitmq:3\.13-alpine/,
    /ci-cd\/ensure-docker-runtime\.sh/,
    /open -ga Docker/,
    /bun install --frozen-lockfile/,
    /bun run mono:build/,
    /mono:build:deps/,
    /bun run mono:test/,
    /bun run ci:integration/,
    /website:deps:build/,
    /FIREBASE_SERVICE_ACCOUNT_KEY/,
    /ci-cd\/ensure-local-ci-services\.sh/,
    /bun run test:coverage/,
    /coverage\/jest\/coverage-final\.json/,
    /bun run coverage:check/,
    /bun run coverage:patch/,
    /website:storybook:build/,
    /website:storybook:smoke/,
    /website:test:prepublish/,
    /website:test:cypress/,
    /gitleaks\.sarif/,
    /semgrep\.sarif/,
    /List review evidence/,
    /Enforce scanner outcomes/,
    /Install verified Codecov CLI/,
    /Upload coverage to Codecov/,
    /codecov --verbose upload-process --disable-search --fail-on-error/,
    /CODECOV_TOKEN/,
    /SonarQube Cloud Scan/,
    /Sonar runs for PRs or pushes targeting dev\/main/,
    /sonar-scanner -Dsonar\.scm\.disabled=true/,
    /Report Sonar findings/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(ciContents)) failures.push(`GitHub Actions CI is missing ${String(marker)}`);
  }

  const heavyContextGuard = /github\.event_name == 'schedule'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+github\.ref_name == 'main'[\s\S]+github\.event_name == 'pull_request' && github\.base_ref == 'main'[\s\S]+github\.head_ref == 'dev'[\s\S]+startsWith\(github\.head_ref, 'codex\/release\/'\)[\s\S]+endsWith\(github\.head_ref, '-dev-main-signed-squash'\)/;
  for (const job of ['workspace-builds', 'workspace-tests', 'integration', 'coverage', 'website', 'database-matrix']) {
    const jobBlock = contents.match(new RegExp(`\\n  ${job}:\\n[\\s\\S]*?(?=\\n  [a-z-]+:\\n|\\n?$)`))?.[0] || '';
    if (!heavyContextGuard.test(jobBlock)) {
      failures.push(`.github/workflows/ci.yml must guard ${job} to release/full contexts`);
    }
  }

  const coverageBlock = contents.match(/\n  coverage:\n[\s\S]*?(?=\n  [a-z-]+:\n|\n?$)/)?.[0] || '';
  if (/RUN_(BROKER|REDIS)_INTEGRATION:\s*'1'/.test(coverageBlock)) {
    failures.push(
      '.github/workflows/ci.yml coverage job must keep real broker/Redis integration suites in dedicated jobs'
    );
  }

  [
    /\n\s+codecov:\s*\n/,
    /\n\s+sonarqube:\s*\n/
  ].forEach((marker) => {
    if (marker.test(contents)) {
      failures.push(
        `Codecov and Sonar must run inside the coverage job, not as separate GitHub Actions jobs: ${String(marker)}`
      );
    }
  });

  if (/runs-on:\s*ubuntu-latest/.test(contents)) {
    failures.push('.github/workflows/ci.yml must use the repository-owned self-hosted runner, not ubuntu-latest');
  }

  if (/uses:\s*actions\//.test(contents)) {
    failures.push('.github/workflows/ci.yml must avoid JavaScript GitHub Actions on the self-hosted runner');
  }
}

for (const retired of ['codecov.yml']) {
  if (fs.existsSync(path.join(root, retired))) {
    failures.push(`${retired} is retired by Requirement 113 and must not remain authoritative.`);
  }
}

if (failures.length > 0) {
  console.error('CI provider check failed (Requirement 113):\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'CI provider check passed: GitHub Actions covers cheap dev gates, full main promotion gates, '
    + 'coverage, website validation, third-party review, and in-job Codecov/Sonar publishing.'
);
