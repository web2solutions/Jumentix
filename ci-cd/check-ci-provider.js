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
const browserMatrixWorkflowPath = path.join(root, '.github', 'workflows', 'browser-matrix.yml');
const preCommitPath = path.join(root, '.husky', 'pre-commit');
const packagePath = path.join(root, 'package.json');
const unitRunnerPath = path.join(root, 'ci-cd', 'run-unit-tests.js');
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
  const unitRunnerContents = fs.existsSync(unitRunnerPath) ? fs.readFileSync(unitRunnerPath, 'utf8') : '';
  const ciContents = `${contents}\n${serviceContents}\n${dockerRuntimeContents}\n${packageContents}\n${unitRunnerContents}`;
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
    /pr-feedback:/,
    /Checkout trusted PR base/,
    /github\.event\.pull_request\.base\.sha/,
    /Bootstrap trusted PR feedback checker/,
    /git fetch --no-tags --depth=1 origin dev/,
    /git checkout origin\/dev -- ci-cd\/check-pr-feedback\.js ci-cd\/lib\/entry-point\.js/,
    /Enforce resolved PR feedback/,
    /sync-changelog:/,
    /github\.event_name == 'push' && github\.ref_name == 'main'/,
    /needs:\s*branch-gate/,
    /group:\s*changelog-main/,
    /cancel-in-progress:\s*false/,
    /contents:\s*write/,
    /bun run changelog:update/,
    /createCommitOnBranch/,
    /expectedHeadOid: \$expectedHeadOid/,
    /commit \{ oid verification \{ verified reason \} \}/,
    /Generated changelog commit was not verified/,
    /git push origin "HEAD:refs\/heads\/\$branch"/,
    /gh pr close "\$prior_pr" --delete-branch/,
    /gh pr create --base main/,
    /--watch --fail-fast/,
    /--squash --delete-branch/,
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
    /install --frozen-lockfile/,
    /bun run mono:build/,
    /"mono:build":\s*"bun run workspace:build:packages"/,
    /workspace:build:packages/,
    /test:unit[\s\S]*--conditions=development/,
    /bun run mono:test/,
    /bun run ci:integration/,
    /website:deps:build/,
    /@jumentix\/shared-contracts build/,
    /FIREBASE_SERVICE_ACCOUNT_KEY/,
    /ci-cd\/ensure-local-ci-services\.sh/,
    /bun run test:coverage/,
    /coverage\/jest\/coverage-final\.json/,
    /bun run coverage:check/,
    /bun run coverage:patch/,
    /JUMENTIX_PATCH_BASE_REF=origin\/dev bun run coverage:patch/,
    /JUMENTIX_PATCH_BASE_REF=origin\/main bun run coverage:patch/,
    /startsWith\(github\.head_ref, 'chore\/changelog-sync-'\)/,
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
    /vars\.JUMENTIX_ENABLE_SONAR == 'true'/,
    /vars\.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'/,
    /needs\.branch-gate\.result == 'skipped'/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(ciContents)) failures.push(`GitHub Actions CI is missing ${String(marker)}`);
  }

  const packageScripts = JSON.parse(packageContents).scripts || {};
  const monorepoBuild = packageScripts['mono:build'];
  const monorepoTest = packageScripts['mono:test'];
  const workspaceBuild = packageScripts['workspace:build:packages'];
  const taskGate = packageScripts['ci:gate:task'];
  if (workspaceBuild !== 'bun ci-cd/build-workspace-packages.js') {
    failures.push('Workspace package build must run the topological level-parallel builder (JUM-871)');
  }
  if (monorepoBuild !== 'bun run workspace:build:packages') {
    failures.push('Monorepo build must delegate to the topological workspace package builder (JUM-871)');
  }
  if (monorepoTest !== 'bun run workspace:build:packages && bun run workspace:test') {
    failures.push('Monorepo tests must build workspace package dependencies before execution (JUM-871)');
  }
  if (!fs.existsSync(path.join(root, 'ci-cd', 'build-workspace-packages.js'))) {
    failures.push('Missing ci-cd/build-workspace-packages.js referenced by workspace:build:packages');
  }
  if (taskGate !== 'bun run workspace:build:packages && bun ci-cd/run-task-change-tests.js') {
    failures.push('Task quality gate must build publishable workspace packages before running selected tests');
  }

  if (!/slug:\s*web2solutions\/Jumentix/.test(contents) || !/disable_search:\s*true/.test(contents)) {
    failures.push('GitHub Actions Codecov upload must set slug=web2solutions/Jumentix and disable_search=true');
  }

  const heavyContextGuard = /github\.event_name == 'schedule'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+github\.ref_name == 'main'[\s\S]+github\.event_name == 'pull_request' && github\.base_ref == 'main'[\s\S]+github\.head_ref == 'dev'[\s\S]+startsWith\(github\.head_ref, 'chore\/changelog-sync-'\)[\s\S]+startsWith\(github\.head_ref, 'codex\/release\/'\)[\s\S]+endsWith\(github\.head_ref, '-dev-main-signed-squash'\)/;
  // Coverage (Codecov + Sonar) must also run on pushes to `dev`.
  const coverageContextGuard = /github\.event_name == 'schedule'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+github\.ref_name == 'main'[\s\S]+github\.ref_name == 'dev'[\s\S]+github\.event_name == 'pull_request' && github\.base_ref == 'main'[\s\S]+github\.head_ref == 'dev'[\s\S]+startsWith\(github\.head_ref, 'chore\/changelog-sync-'\)[\s\S]+startsWith\(github\.head_ref, 'codex\/release\/'\)[\s\S]+endsWith\(github\.head_ref, '-dev-main-signed-squash'\)/;
  for (const job of ['workspace-builds', 'workspace-tests', 'integration', 'coverage', 'website', 'database-matrix']) {
    const jobBlock = contents.match(new RegExp(`\\n  ${job}:\\n[\\s\\S]*?(?=\\n  [a-z-]+:\\n|\\n?$)`))?.[0] || '';
    const guard = job === 'coverage' ? coverageContextGuard : heavyContextGuard;
    const expected = job === 'coverage' ? 'main/dev/release contexts' : 'release/full contexts';
    if (!guard.test(jobBlock)) {
      failures.push(`.github/workflows/ci.yml must guard ${job} to ${expected}`);
    }
  }

  // Requirement 113 (2026-09-23 amendment): CircleCI is canonical; every retained
  // GitHub Actions matrix job must stay disabled by default behind the single
  // reversible flag. Always-on exceptions (pr-feedback, sync-changelog,
  // pr-feedback.yml, npm-publish.yml) are intentionally absent from this list.
  const disableFlagGuard = /vars\.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'/;
  for (const job of ['branch-gate', 'third-party-review', 'workspace-builds', 'workspace-tests', 'integration', 'coverage', 'website', 'database-matrix']) {
    const jobBlock = contents.match(new RegExp(`\\n  ${job}:\\n[\\s\\S]*?(?=\\n  [a-z-]+:\\n|\\n?$)`))?.[0] || '';
    if (!disableFlagGuard.test(jobBlock)) {
      failures.push(`.github/workflows/ci.yml must gate ${job} behind vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true' (JUM-876)`);
    }
  }

  const databaseMatrixBlock = contents.match(/\n  database-matrix:\n[\s\S]*?(?=\n  [a-z-]+:\n|\n?$)/)?.[0] || '';
  if (!/Build workspace package dependencies[\s\S]*bun run mono:build/.test(databaseMatrixBlock)) {
    failures.push('Database matrix must build workspace package dependencies before running isolated smoke tests');
  }

  const coverageBlock = contents.match(/\n  coverage:\n[\s\S]*?(?=\n  [a-z-]+:\n|\n?$)/)?.[0] || '';
  if (/RUN_(BROKER|REDIS)_INTEGRATION:\s*'1'/.test(coverageBlock)) {
    failures.push(
      '.github/workflows/ci.yml coverage job must keep real broker/Redis integration suites in dedicated jobs'
    );
  }
  if (!/Build workspace package dependencies for frontend coverage[\s\S]*bun run mono:build[\s\S]*Produce frontend coverage for the patch report/.test(coverageBlock)) {
    failures.push(
      'Coverage job must build workspace package dependencies before frontend patch coverage'
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
  /name:\s*PR feedback trusted/,
  /pr-feedback-trusted:/,
  /issues:\s*read/,
  /GH_TOKEN:\s*\$\{\{ github\.token \}\}/,
  /check-pr-feedback\.js --repo/,
  /github\.event\.pull_request\.number/
]);

function checkSonarReliabilityWorkflow(workflowPathToCheck) {
  if (!fs.existsSync(workflowPathToCheck)) {
    failures.push(`Missing required Sonar reliability workflow: ${path.relative(root, workflowPathToCheck)}`);
    return;
  }
  const contents = fs.readFileSync(workflowPathToCheck, 'utf8');
  const requiredMarkers = [
    /name:\s*Sonar reliability/,
    /pull_request:/,
    /branches:\s*\n\s*- dev\s*\n\s*- main/,
    /sonar-reliability:/,
    /permissions:\s*\n\s*contents:\s*read/,
    /uses:\s*actions\/checkout@v5/,
    /fetch-depth:\s*0/,
    /persist-credentials:\s*false/,
    /SONAR_TOKEN:\s*\$\{\{ secrets\.SONARCLOUD_TOKEN \}\}/,
    /SONAR_PULL_REQUEST:\s*\$\{\{ github\.event\.pull_request\.number \}\}/,
    /sonar-scanner/,
    /-Dsonar\.pullrequest\.key="\$SONAR_PULL_REQUEST"/,
    /-Dsonar\.pullrequest\.branch="\$SONAR_PULL_REQUEST_BRANCH"/,
    /-Dsonar\.pullrequest\.base="\$SONAR_PULL_REQUEST_BASE"/,
    /bun run sonar:check-reliability/,
    /seq 1 18/,
    /vars\.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(contents)) failures.push(`Sonar reliability workflow is missing ${String(marker)}`);
  }
  if (/pull_request_target:|git worktree add|refs\/pull\/\$\{SONAR_PULL_REQUEST\}\/merge/.test(contents)) {
    failures.push('Sonar reliability must analyze PR code only in the unprivileged pull_request workflow.');
  }
  if (/(?:contents|issues|pull-requests|actions|checks):\s*write/.test(contents)) {
    failures.push('Sonar reliability workflow must retain read-only GitHub token permissions.');
  }
}

checkSonarReliabilityWorkflow(sonarReliabilityWorkflowPath);

function checkBrowserMatrixWorkflow(workflowPathToCheck) {
  if (!fs.existsSync(workflowPathToCheck)) {
    failures.push(`Missing required browser matrix workflow: ${path.relative(root, workflowPathToCheck)}`);
    return;
  }
  const contents = fs.readFileSync(workflowPathToCheck, 'utf8');
  const requiredMarkers = [
    /name:\s*Browser matrix/,
    /pull_request:/,
    /branches:\s*\n\s*- dev\s*\n\s*- main/,
    /browser-matrix:/,
    /contents:\s*read/,
    /uses:\s*actions\/checkout@v5/,
    /persist-credentials:\s*false/,
    /BUN_VERSION:\s*1\.3\.13/,
    /export PATH="\$HOME\/\.bun\/bin:\$PATH"/,
    /install --frozen-lockfile/,
    /bun x cypress install/,
    /bun x cypress verify/,
    /bun x playwright install webkit/,
    /bun x playwright install-deps webkit/,
    /for engine in chrome firefox webkit/,
    /packages\/cana\/scripts\/run-browser-tests\.js/,
    /vars\.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(contents)) failures.push(`Browser matrix workflow is missing ${String(marker)}`);
  }
  if (/pull_request_target:|secrets\./.test(contents)) {
    failures.push('Browser matrix must run untrusted PR code without privileged events or secrets.');
  }
}

checkBrowserMatrixWorkflow(browserMatrixWorkflowPath);

if (!fs.existsSync(preCommitPath)) {
  failures.push('Missing required local hook: .husky/pre-commit');
} else {
  const contents = fs.readFileSync(preCommitPath, 'utf8');
  if (/changelog:update|git add CHANGELOG\.md/.test(contents)) {
    failures.push('Local pre-commit must not mutate CHANGELOG.md; GitHub Actions owns main synchronization.');
  }
}

if (!fs.existsSync(preCommitPath)) {
  failures.push('Missing required local hook: .husky/pre-commit');
} else {
  const contents = fs.readFileSync(preCommitPath, 'utf8');
  if (/changelog:update|git add CHANGELOG\.md/.test(contents)) {
    failures.push('Local pre-commit must not mutate CHANGELOG.md; GitHub Actions owns main synchronization.');
  }
}

if (fs.existsSync(circleciPath)) {
  const contents = fs.readFileSync(circleciPath, 'utf8');
  // Requirement 113 (2026-09-23 amendment): CircleCI is the canonical
  // orchestrator, so its contract is asserted with the same rigor the GitHub
  // Actions workflow always had.
  const requiredMarkers = [
    /version:\s*2\.1/,
    /cimg\/node:22/,
    /branch-gate:/,
    /third-party-review:/,
    /browser-matrix:/,
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
    /report-sonar-findings\.js/,
    /sonar:check-reliability/,
    /for engine in chrome firefox webkit/,
    /packages\/cana\/scripts\/run-browser-tests\.js/,
    /cron:\s*"17 3 \* \* \*"/
  ];
  for (const marker of requiredMarkers) {
    if (!marker.test(contents)) failures.push(`CircleCI CI is missing ${String(marker)}`);
  }

  const browserMatrixBlock = contents.match(/\n  browser-matrix:\n[\s\S]*?(?=\n  [a-z_-]+:\n|\n?$)/)?.[0] || '';
  if (!/require_ci_job:\s*\n\s*job:\s*browser-matrix/.test(browserMatrixBlock)) {
    failures.push('CircleCI browser-matrix job must gate on the shared context classifier via require_ci_job');
  }
  const workflowJobsBlock = contents.match(/\nworkflows:\n[\s\S]*$/)?.[0] || '';
  if (!/- browser-matrix/.test(workflowJobsBlock)) {
    failures.push('CircleCI workflows.ci.jobs must include browser-matrix');
  }
  const scheduleBlock = contents.match(/triggers:[\s\S]*?schedule:[\s\S]*?(?=\n    jobs:|\nworkflow|$)/)?.[0] || '';
  if (!/only:\s*\n\s*- main\s*\n\s*- dev/.test(scheduleBlock)) {
    failures.push('CircleCI nightly schedule trigger must target main and dev');
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
  'CI provider check passed: CircleCI is the canonical orchestrator (branch gate, browser matrix, full '
    + 'promotion matrix, coverage, website, third-party review, Codecov/Sonar publishing, nightly schedule); '
    + 'GitHub Actions retains the same surface disabled-by-default behind JUMENTIX_ENABLE_GITHUB_ACTIONS_CI, '
    + 'with pr-feedback, sync-changelog, and npm-publish always-on.'
);
