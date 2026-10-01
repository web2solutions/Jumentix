#!/usr/bin/env node
/**
 * Repository entry point (`bun x github:web2solutions/Jumentix#dev`). Runs the
 * local CLI build when present, otherwise the published @jumentix/cli-init
 * (JUM-901).
 */
require('../packages/cli-init/bin/launcher.js').launch(process.argv.slice(2));
