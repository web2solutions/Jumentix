#!/usr/bin/env bun

const PROJECT_KEY = 'web2solutions_Jumentix';
const REQUIRED_RELIABILITY_RATING = 1;
const { isEntryPoint } = require('./lib/entry-point.js');

function resolveBranch(env = process.env) {
  return env.SONAR_BRANCH || env.GITHUB_BASE_REF || env.GITHUB_REF_NAME || '';
}

function buildMeasuresUrl(branch, hostUrl = 'https://sonarcloud.io') {
  const url = new URL('/api/measures/component', hostUrl);
  url.searchParams.set('component', PROJECT_KEY);
  url.searchParams.set('metricKeys', 'reliability_rating');
  url.searchParams.set('branch', branch);
  return url;
}

function authHeader(token) {
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` };
}

async function checkSonarReliability({ env = process.env, fetchFn = fetch } = {}) {
  const token = env.SONAR_TOKEN;
  const branch = resolveBranch(env);
  if (!token) throw new Error('SONAR_TOKEN is required to enforce SonarCloud reliability.');
  if (!branch) throw new Error('A SonarCloud branch is required to enforce reliability.');

  const response = await fetchFn(buildMeasuresUrl(branch, env.SONAR_HOST_URL), {
    headers: authHeader(token)
  });
  if (!response.ok) {
    throw new Error(`SonarCloud reliability request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rating = payload.component?.measures?.find((measure) => measure.metric === 'reliability_rating')?.value;
  if (Number(rating) !== REQUIRED_RELIABILITY_RATING) {
    throw new Error(
      `SonarCloud reliability for ${branch} is ${rating ?? 'unavailable'}; A (1) is required.`
    );
  }

  console.log(`[sonar] reliability for ${branch}: A`);
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
  resolveBranch
};
