#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Legacy entry: maps historic flags onto the command router (Req 037 v2).
 */
const { runAsCli } = require('../dist/cli');

runAsCli(process.argv.slice(2)).catch((error) => {
  console.error(`\nBootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
