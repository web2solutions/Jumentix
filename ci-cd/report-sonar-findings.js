#!/usr/bin/env bun
/**
 * Print SonarQube Cloud's findings into the CI log.
 *
 * Without this, a failed quality gate reports two letters and a link:
 *
 *     D Reliability Rating on New Code (required ≥ A)
 *     C Security Rating on New Code (required ≥ A)
 *
 * and the link needs a SonarCloud session. Anyone without one — an agent, a
 * contributor outside the org, anyone reading the log from a phone — can see
 * that the gate failed but not why, which makes the failure undiagnosable from
 * the artifact that reported it. Requirement `065` treats a check nobody can act
 * on as no better than one that did not run.
 *
 * The token never leaves CI: this runs inside the job that already holds it, and
 * prints only issue metadata.
 *
 * Advisory by design — it exits 0 even when it cannot reach the API. The quality
 * gate is what blocks; this only explains it, and a reporting step that could
 * fail the build would mean a Sonar outage blocking merges over nothing.
 */

const fs = require('node:fs');
const path = require('node:path');
const { isEntryPoint } = require('./lib/entry-point.js');

const repoRoot = path.resolve(__dirname, '..');
const taskFile = path.join(repoRoot, '.scannerwork', 'report-task.txt');

/** Poll the analysis task until the server has processed the submitted report. */
const ANALYSIS_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 5_000;

/** Parse `key=value` lines from the scanner's report-task.txt. */
function readTaskMetadata(contents) {
  const metadata = {};
  for (const line of contents.split('\n')) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return metadata;
}

function authHeader(token) {
  // SonarQube Cloud takes the token as the basic-auth username with no password.
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` };
}

async function fetchJson(url, token) {
  const response = await fetch(url, { headers: authHeader(token) });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Wait for the submitted analysis to finish processing.
 *
 * Issues are not queryable until then, so fetching immediately after the scanner
 * exits returns an empty list — which would read as "no findings" on exactly the
 * run that had them.
 */
async function waitForAnalysis(ceTaskUrl, token, now = () => Date.now()) {
  const deadline = now() + ANALYSIS_TIMEOUT_MS;

  while (now() < deadline) {
    // eslint-disable-next-line no-await-in-loop -- polling is the point
    const { task } = await fetchJson(ceTaskUrl, token);
    if (task.status === 'SUCCESS') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`analysis task ${task.status}`);
    }
    // eslint-disable-next-line no-await-in-loop -- polling is the point
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`analysis did not finish within ${ANALYSIS_TIMEOUT_MS / 1000}s`);
}

/** One line per issue, ordered so the worst reads first. */
function formatIssues(issues) {
  const severityOrder = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
  const rank = (issue) => {
    const index = severityOrder.indexOf(issue.severity);
    return index === -1 ? severityOrder.length : index;
  };

  return [...issues]
    .sort((left, right) => rank(left) - rank(right))
    .map((issue) => {
      const file = String(issue.component).split(':').pop();
      const line = issue.line === undefined ? '' : `:${String(issue.line)}`;
      return `  ${issue.type} ${issue.severity} ${file}${line}\n`
        + `    ${issue.message}\n`
        + `    rule: ${issue.rule}`;
    });
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    console.log('[sonar] SONAR_TOKEN is not set; skipping findings report.');
    return;
  }
  if (!fs.existsSync(taskFile)) {
    console.log(`[sonar] no ${path.relative(repoRoot, taskFile)}; scanner did not run here.`);
    return;
  }

  const metadata = readTaskMetadata(fs.readFileSync(taskFile, 'utf8'));
  const { ceTaskUrl, serverUrl, projectKey } = metadata;
  const pullRequest = process.env.SONAR_PULL_REQUEST_KEY || metadata.pullRequest;

  await waitForAnalysis(ceTaskUrl, token);

  const scope = pullRequest ? `&pullRequest=${pullRequest}` : '';
  const [{ issues = [] }, { hotspots = [] }] = await Promise.all([
    fetchJson(
      `${serverUrl}/api/issues/search?componentKeys=${projectKey}${scope}&resolved=false&ps=100`,
      token
    ),
    fetchJson(
      `${serverUrl}/api/hotspots/search?projectKey=${projectKey}${scope}&status=TO_REVIEW&ps=100`,
      token
    )
  ]);

  if (issues.length === 0 && hotspots.length === 0) {
    console.log('[sonar] no open issues or hotspots on this analysis.');
    return;
  }

  console.log(`\n[sonar] ${issues.length} open issue(s):\n`);
  for (const line of formatIssues(issues)) console.log(line);

  if (hotspots.length > 0) {
    console.log(`\n[sonar] ${hotspots.length} security hotspot(s) to review:\n`);
    for (const hotspot of hotspots) {
      const file = String(hotspot.component).split(':').pop();
      console.log(`  ${hotspot.vulnerabilityProbability} ${file}:${hotspot.line ?? '?'}`);
      console.log(`    ${hotspot.message}`);
    }
  }
  console.log('');
}

if (isEntryPoint(module)) {
  main().catch((error) => {
    // Advisory: never fail the build for a reporting step. The quality gate
    // blocks; this only explains it.
    console.log(`[sonar] could not report findings: ${error.message}`);
  });
}

module.exports = {
  ANALYSIS_TIMEOUT_MS,
  formatIssues,
  main,
  readTaskMetadata,
  waitForAnalysis
};
