#!/usr/bin/env bun

const PROJECT_KEY = 'web2solutions_Jumentix';
const REQUIRED_RELIABILITY_RATING = 1;
const { isEntryPoint } = require('./lib/entry-point.js');

function resolveBranch(env = process.env) {
  return env.SONAR_BRANCH || env.GITHUB_BASE_REF || env.GITHUB_REF_NAME || '';
}

function resolveAnalysisTarget(env = process.env) {
  if (env.SONAR_PULL_REQUEST) return { pullRequest: env.SONAR_PULL_REQUEST };
  return { branch: resolveBranch(env) };
}

function buildMeasuresUrl(target, hostUrl = 'https://sonarcloud.io') {
  const url = new URL('/api/measures/component', hostUrl);
  url.searchParams.set('component', PROJECT_KEY);
  url.searchParams.set('metricKeys', 'reliability_rating');
  if (typeof target === 'string') url.searchParams.set('branch', target);
  else if (target?.pullRequest) url.searchParams.set('pullRequest', target.pullRequest);
  else if (target?.branch) url.searchParams.set('branch', target.branch);
  else throw new Error('A SonarCloud branch or pull request is required to enforce reliability.');
  return url;
}

function authHeader(token) {
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` };
}

async function checkSonarReliability({ env = process.env, fetchFn = fetch } = {}) {
  const token = env.SONAR_TOKEN;
  const target = resolveAnalysisTarget(env);
  const targetLabel = target.pullRequest ? `PR #${target.pullRequest}` : target.branch;
  if (!token) throw new Error('SONAR_TOKEN is required to enforce SonarCloud reliability.');
  if (!targetLabel) throw new Error('A SonarCloud branch or pull request is required to enforce reliability.');

  const response = await fetchFn(buildMeasuresUrl(target, env.SONAR_HOST_URL), {
    headers: authHeader(token)
  });
  if (!response.ok) {
    throw new Error(`SonarCloud reliability request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rating = payload.component?.measures?.find((measure) => measure.metric === 'reliability_rating')?.value;
  if (Number(rating) !== REQUIRED_RELIABILITY_RATING) {
    throw new Error(
      `SonarCloud reliability for ${targetLabel} is ${rating ?? 'unavailable'}; A (1) is required.`
    );
  }

  console.log(`[sonar] reliability for ${targetLabel}: A`);
}

if (isEntryPoint(module)) {
  checkSonarReliability().catch((error) => {
    console.error(`[sonar] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  PROJECT_KEY,
  REQUIRED_RELIABILITY_RATING,
  authHeader,
  buildMeasuresUrl,
  checkSonarReliability,
  resolveAnalysisTarget,
  resolveBranch
};
