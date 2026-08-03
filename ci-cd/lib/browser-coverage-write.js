#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Writes the browser run's coverage report.
 *
 * A separate entry point because remapping through a source map is
 * asynchronous and the runner that calls it is not. One small process is a
 * smaller price than making the runner async or taking a dependency whose only
 * job is to make an async call look synchronous.
 */

const fs = require('node:fs');
const path = require('node:path');
const { collect } = require('./browser-coverage.js');

const [rawDir, output] = process.argv.slice(2);

collect(rawDir).then((result) => {
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
    return;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result.coverage.toJSON()));
  console.log(`Browser coverage written for ${result.coverage.files().length} source file(s).`);
}).catch((error) => {
  console.error(String(error?.stack ?? error));
  process.exit(1);
});
