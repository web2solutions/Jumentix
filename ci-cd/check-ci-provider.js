#!/usr/bin/env bun
/** Requirement 113 — public open-source CI provider contract. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

const circleciPath = path.join(root, '.circleci', 'config.yml');
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
const feedbackWorkflowPath = path.join(root, '.github', 'workflows', 'pr-feedback.yml');
const sonarReliabilityWorkflowPath = path.join(root, '.github', 'workflows', 'sonar-reliability.yml');
const preCommitPath = path.join(root, '.husky', 'pre-commit');
const packagePath = path.join(root, 'package.json');
const sonarPath = path.join(root, 'sonar-project.properties');

if (!fs.existsSync(circleciPath)) {
  failures.push('Missing required CircleCI workflow: .circleci/config.yml');
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
    /runs-on:\s*ubuntu-latest/,
    /uses:\s*actions\/checkout@v5/,
    /uses:\s*actions\/setup-node@v5/,
    /node-version:\s*22/,
    /curl -fsSL -o \/tmp\/bun-install\.sh https:\/\/bun\.sh\/install/,
    /bash \/tmp\/bun-install\.sh "bun-v\$BUN_VERSION"/,
    /test -x "\$HOME\/\.bun\/bin\/bun"/,
    /branch-gate:/,
    /sync-changelog:/,
    /github\.event_name == 'push' && github\.ref_name == 'dev'/,
    /needs:\s*branch-gate/,
    /group:\s*changelog-dev/,
    /cancel-in-progress:\s*false/,
    /contents:\s*write/,
    /bun run changelog:update/,
    /git push origin HEAD:dev/,
    /task-branch-push/,
    /third-party-review:/,
    /workspace-builds:/,
    /workspace-tests:/,
    /integration:/,
    /coverage:/,
    /environment:\s*env vars/,
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
    /Upload coverage reports to Codecov/,
    /codecov\/codecov-action@v5/,
    /uses:\s*codecov\/codecov-action@[0-9a-f]{40}/,
    /files:\s*coverage\/lcov\.info,coverage\/browser\/lcov\.info/,
    /fail_ci_if_error:\s*true/,
    /CODECOV_TOKEN/,
    /secrets\.SONARCLOUD_TOKEN/,
    /Verify Codecov public coverage reports/,
    /verify-codecov-public-reports\.js/,
    /SonarQube Cloud Scan/,
    /Sonar analyses main and dev only/,
    /sonar-scanner -Dsonar\.scm\.disabled=true/,
    /Report Sonar findings/,
    /Enforce SonarCloud reliability A/,
    /sonar:check-reliability/,
    /vars\.JUMENTIX_ENABLE_SONAR == 'true'/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(ciContents)) failures.push(`GitHub Actions CI is missing ${String(marker)}`);
  }

  if (!/slug:\s*web2solutions\/Jumentix/.test(contents) || !/disable_search:\s*true/.test(contents)) {
    failures.push('GitHub Actions Codecov upload must set slug=web2solutions/Jumentix and disable_search=true');
  }

  const heavyContextGuard = /github\.event_name == 'schedule'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+github\.ref_name == 'main'[\s\S]+github\.event_name == 'pull_request' && github\.base_ref == 'main'[\s\S]+github\.head_ref == 'dev'[\s\S]+startsWith\(github\.head_ref, 'codex\/release\/'\)[\s\S]+endsWith\(github\.head_ref, '-dev-main-signed-squash'\)/;
  // Coverage (Codecov + Sonar) must also run on pushes to `dev`.
  const coverageContextGuard = /github\.event_name == 'schedule'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+github\.ref_name == 'main'[\s\S]+github\.ref_name == 'dev'[\s\S]+github\.event_name == 'pull_request' && github\.base_ref == 'main'[\s\S]+github\.head_ref == 'dev'[\s\S]+startsWith\(github\.head_ref, 'codex\/release\/'\)[\s\S]+endsWith\(github\.head_ref, '-dev-main-signed-squash'\)/;
  for (const job of ['workspace-builds', 'workspace-tests', 'integration', 'coverage', 'website', 'database-matrix']) {
    const jobBlock = contents.match(new RegExp(`\\n  ${job}:\\n[\\s\\S]*?(?=\\n  [a-z-]+:\\n|\\n?$)`))?.[0] || '';
    const guard = job === 'coverage' ? coverageContextGuard : heavyContextGuard;
    const expected = job === 'coverage' ? 'main/dev/release contexts' : 'release/full contexts';
    if (!guard.test(jobBlock)) {
      failures.push(`.github/workflows/ci.yml must guard ${job} to ${expected}`);
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

  if (/runs-on:\s*\[self-hosted,\s*jumentix\]/.test(contents)) {
    failures.push('.github/workflows/ci.yml must use GitHub-hosted ubuntu-latest runners for the public open-source repository');
  }

  if (/Checkout repository without JavaScript Actions/.test(contents)) {
    failures.push('.github/workflows/ci.yml must not keep the old self-hosted manual checkout path');
  }

  if (/curl -fsSL https:\/\/bun\.sh\/install \| bash/.test(contents)) {
    failures.push('.github/workflows/ci.yml Bun installation must fail closed instead of masking curl failures in a pipeline.');
  }
}

function checkTrustedPullRequestWorkflow(workflowPathToCheck, label, requiredMarkers) {
  if (!fs.existsSync(workflowPathToCheck)) {
    failures.push(`Missing required trusted pull-request workflow: ${path.relative(root, workflowPathToCheck)}`);
    return;
  }
  const contents = fs.readFileSync(workflowPathToCheck, 'utf8');
  const commonMarkers = [
    /pull_request_target:/,
    /branches:\s*\n\s*- dev\s*\n\s*- main/,
    /permissions:\s*\n\s*contents:\s*read/,
    /pull-requests:\s*read/,
    /uses:\s*actions\/checkout@v5/,
    /ref:\s*\$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
    /persist-credentials:\s*false/,
    /BUN_VERSION:\s*1\.3\.13/
  ];
  for (const marker of [...commonMarkers, ...requiredMarkers]) {
    if (!marker.test(contents)) failures.push(`${label} is missing ${String(marker)}`);
  }
  if (/curl -fsSL https:\/\/bun\.sh\/install \| bash/.test(contents)) {
    failures.push(`${label} Bun installation must fail closed instead of masking curl failures in a pipeline.`);
  }
  if (/(?:contents|issues|pull-requests|actions|checks):\s*write/.test(contents)) {
    failures.push(`${label} must retain read-only GitHub token permissions.`);
  }
  if (/github\.event\.pull_request\.head\.sha|ref:\s*\$\{\{ github\.sha \}\}/.test(contents)) {
    failures.push(`${label} must execute only the trusted PR base revision.`);
  }
}

checkTrustedPullRequestWorkflow(feedbackWorkflowPath, 'PR feedback workflow', [
  /name:\s*PR feedback/,
  /pr-feedback:/,
  /issues:\s*read/,
  /GH_TOKEN:\s*\$\{\{ github\.token \}\}/,
  /check-pr-feedback\.js --repo/,
  /github\.event\.pull_request\.number/
]);

checkTrustedPullRequestWorkflow(sonarReliabilityWorkflowPath, 'Sonar reliability workflow', [
  /name:\s*Sonar reliability/,
  /sonar-reliability:/,
  /SONAR_TOKEN:\s*\$\{\{ secrets\.SONARCLOUD_TOKEN \}\}/,
  /SONAR_PULL_REQUEST:\s*\$\{\{ github\.event\.pull_request\.number \}\}/,
  /bun run sonar:check-reliability/,
  /seq 1 18/
]);

if (!fs.existsSync(preCommitPath)) {
  failures.push('Missing required local hook: .husky/pre-commit');
} else {
  const contents = fs.readFileSync(preCommitPath, 'utf8');
  if (/changelog:update|git add CHANGELOG\.md/.test(contents)) {
    failures.push('Local pre-commit must not mutate CHANGELOG.md; GitHub Actions owns dev synchronization.');
  }
}

if (fs.existsSync(circleciPath)) {
  const contents = fs.readFileSync(circleciPath, 'utf8');
  const requiredMarkers = [
    /version:\s*2\.1/,
    /cimg\/node:22/,
    /branch-gate:/,
    /third-party-review:/,
    /workspace-builds:/,
    /workspace-tests:/,
    /integration:/,
    /coverage:/,
    /website:/,
    /database-matrix:/,
    /classify-ci-context\.js/,
    /circleci-agent step halt/,
    /codecov --verbose upload-process --disable-search --fail-on-error/,
    /--slug web2solutions\/Jumentix/,
    /verify-codecov-public-reports\.js/,
    /sonar-scanner -Dsonar\.scm\.disabled=true/,
    /sonar:check-reliability/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(contents)) failures.push(`CircleCI CI is missing ${String(marker)}`);
  }
}

if (!fs.existsSync(sonarPath)) {
  failures.push('Missing required Sonar project configuration: sonar-project.properties');
} else {
  const sonarContents = fs.readFileSync(sonarPath, 'utf8').replace(/\\\s*\n\s*/g, '');
  const requiredMarkers = [
    /^sonar\.sourceEncoding=UTF-8$/m,
    /^sonar\.exclusions=.*\*\*\/\*\.png/m,
    /^sonar\.exclusions=.*\*\*\/\*\.jpg/m,
    /^sonar\.exclusions=.*\*\*\/\*\.webp/m,
    /^sonar\.exclusions=.*\*\*\/\*\.ico/m,
    /^sonar\.exclusions=.*\*\*\/\*\.woff2/m
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(sonarContents)) {
      failures.push(`Sonar configuration is missing encoding-safe source scan marker: ${String(marker)}`);
    }
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
  'CI provider check passed: GitHub Actions and CircleCI cover cheap dev gates, full main promotion gates, '
    + 'coverage, website validation, third-party review, resolved PR feedback, and Codecov/Sonar publishing.'
);
