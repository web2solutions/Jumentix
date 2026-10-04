/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

function collectHandlerPaths(serverlessSource) {
  const handlerRegex = /handler:\s*'([^']+)'/g;
  const handlers = [];
  let match = handlerRegex.exec(serverlessSource);
  while (match) {
    handlers.push(match[1]);
    match = handlerRegex.exec(serverlessSource);
  }
  return handlers;
}

function buildCandidatePaths(handlerPathWithoutExtension) {
  const candidates = new Set([`${handlerPathWithoutExtension}.ts`]);

  const withoutAppPrefix = handlerPathWithoutExtension.startsWith('apps/backend-template/')
    ? handlerPathWithoutExtension.replace('apps/backend-template/', '')
    : handlerPathWithoutExtension;
  candidates.add(`${withoutAppPrefix}.ts`);

  const legacyApiPath = withoutAppPrefix.replace('/interface/restapi/', '/interface/api/');
  candidates.add(`${legacyApiPath}.ts`);

  const legacyApiWithAppPrefix = handlerPathWithoutExtension.replace(
    '/interface/restapi/',
    '/interface/api/'
  );
  candidates.add(`${legacyApiWithAppPrefix}.ts`);

  return Array.from(candidates);
}

function validateServerlessHandlers() {
  const root = process.cwd();
  const serverlessFile = path.join(root, 'serverless.ts');

  if (!fs.existsSync(serverlessFile)) {
    console.error(`Missing serverless file: ${serverlessFile}`);
    process.exitCode = 1;
    return;
  }

  const source = fs.readFileSync(serverlessFile, 'utf8');
  const handlers = collectHandlerPaths(source);

  if (handlers.length === 0) {
    console.error('No handlers were found in serverless.ts');
    process.exitCode = 1;
    return;
  }

  const missing = handlers
    .map((handlerPath) => handlerPath.split('.').slice(0, -1).join('.'))
    .map((handlerPathWithoutExtension) => {
      const candidates = buildCandidatePaths(handlerPathWithoutExtension);
      const hasAnyCandidate = candidates.some((candidate) =>
        fs.existsSync(path.join(root, candidate))
      );
      return hasAnyCandidate ? null : `${handlerPathWithoutExtension}.ts`;
    })
    .filter(Boolean);

  if (missing.length > 0) {
    console.error('Serverless handler path validation failed. Missing files:');
    missing.forEach((missingPath) => console.error(`- ${missingPath}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Serverless handler path validation passed (${handlers.length} handlers).`);
}

validateServerlessHandlers();
