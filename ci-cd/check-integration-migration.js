/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const INTEGRATION_POLICY_PATH = 'INTEGRATION-MIGRATION-REQUIREMENT.md';
const INTEGRATION_POLICY_PT_PATH = 'INTEGRATION-MIGRATION-REQUIREMENT.pt-BR.md';
const PACKAGE_JSON_PATH = 'package.json';
const BOOTSTRAP_PATH = 'packages/cli-init/src/bootstrap.js';
const REGISTRY_SOURCE_PATH = '.agents/registry-source.json';
const README_PATH = 'README.md';

const INTEGRATION_MARKERS = Object.freeze([
  'XpertMinds/Jumentix',
  'web2solutions/aaa-typescript-boilerplate',
  'GitHub Actions',
  'Repository webhooks',
  'CircleCI',
  'Codecov',
  'SonarQube Cloud',
  'OSV.dev',
  'GitGuardian',
  'Cursor Bugbot',
  'Vercel',
  'Dependabot',
  'AAA_JWT_TOKEN_SECRET_KEY',
  'AAA_REDIS_PASSWORD',
  'owner-auth blocker',
  'JUM-568',
  'JUM-569'
]);

const CANONICAL_CONFIG_EXPECTATIONS = Object.freeze([
  {
    path: PACKAGE_JSON_PATH,
    markers: [
      'https://github.com/XpertMinds/Jumentix#readme',
      'https://github.com/XpertMinds/Jumentix/issues'
    ]
  },
  {
    path: BOOTSTRAP_PATH,
    markers: ['https://github.com/XpertMinds/Jumentix.git']
  },
  {
    path: REGISTRY_SOURCE_PATH,
    markers: ['XpertMinds/jumentix-agent-registry']
  },
  {
    path: README_PATH,
    markers: [
      'XpertMinds/Jumentix',
      'web2solutions/aaa-typescript-boilerplate',
      '`103`'
    ]
  }
]);

function read(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function validateIntegrationPolicy(content) {
  return INTEGRATION_MARKERS
    .filter((marker) => !String(content || '').includes(marker))
    .map((marker) => `Integration migration requirement is missing marker: ${marker}.`);
}

function validateCanonicalConfig(rootDir = process.cwd()) {
  const errors = [];

  for (const expectation of CANONICAL_CONFIG_EXPECTATIONS) {
    const absolutePath = path.join(rootDir, expectation.path);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`Missing canonical configuration file: ${expectation.path}`);
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    for (const marker of expectation.markers) {
      if (!content.includes(marker)) {
        errors.push(`${expectation.path} is missing canonical marker: ${marker}`);
      }
    }
  }

  return errors;
}

function main(rootDir = process.cwd()) {
  const policy = read(rootDir, INTEGRATION_POLICY_PATH);
  const policyPt = read(rootDir, INTEGRATION_POLICY_PT_PATH);
  const errors = [
    ...validateIntegrationPolicy(policy),
    ...validateIntegrationPolicy(policyPt).map((error) => `pt-BR: ${error}`),
    ...validateCanonicalConfig(rootDir)
  ];

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return errors;
  }

  console.log('Integration migration contract is complete.');
  return [];
}

if (require.main === module) {
  main();
}

module.exports = {
  INTEGRATION_MARKERS,
  main,
  validateCanonicalConfig,
  validateIntegrationPolicy
};
