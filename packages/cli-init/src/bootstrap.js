/**
 * Compatibility shim for suites and tools that still resolve the historic
 * `src/bootstrap.js` path. Implementation lives in TypeScript under
 * `src/legacy/bootstrap.ts` and is emitted to `dist/legacy/bootstrap.js`.
 */
module.exports = require('../dist/legacy/bootstrap');
