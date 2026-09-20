#!/usr/bin/env node
/* eslint-disable no-console */
const { runAsCli } = require('../dist/cli');

runAsCli().catch((error) => {
  console.error(`\nCLI failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
