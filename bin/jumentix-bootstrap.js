#!/usr/bin/env node
/* eslint-disable no-console */
const { runAsCli } = require('../packages/cli-init/dist/cli');

runAsCli().catch((error) => {
  console.error(`\nBootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
