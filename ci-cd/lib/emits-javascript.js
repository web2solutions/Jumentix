/**
 * Whether a TypeScript file emits any JavaScript at all.
 *
 * A file of nothing but `interface` and `type` declarations compiles to an
 * empty module. It can never appear in a coverage report, and no test can ever
 * execute a line of it — so any check that treats it as testable source is
 * asking for something that cannot exist.
 *
 * Two checks need this answer and used to disagree about it. `check-patch-
 * coverage` counted every line of a type-only file as an uncovered miss;
 * `check-package-suites` counted a package of nothing but types as owing a
 * suite. Same question, one implementation.
 *
 * It is answered by asking the compiler rather than by pattern-matching the
 * source: a name like `IFoo.ts` is a convention, not a guarantee, and a file
 * that mixes one constant in with its types must stay a subject. When
 * TypeScript is unavailable it reports that the file does emit — the direction
 * that fails loudly rather than the one that hides a gap.
 */

const fs = require('node:fs');

function emitsNoJavaScript(absolutePath, readFile = (file) => fs.readFileSync(file, 'utf8')) {
  // A declaration file emits nothing, by definition. Answered without asking
  // the compiler, because it is the one case that needs no evidence.
  if (absolutePath.endsWith('.d.ts')) return true;

  try {
    // eslint-disable-next-line global-require
    const ts = require('typescript');
    const emitted = ts.transpileModule(readFile(absolutePath), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        // Without this the emitted text keeps every comment, so a well
        // documented type-only file reads as executable. Not hypothetical:
        // `security-scanner/src/index.d.ts` is types and prose, and the
        // patch-coverage gate counted sixty-three of its lines as uncovered
        // because its docstrings survived into the output.
        removeComments: true
      }
    }).outputText;

    // What is left for a type-only module: the "use strict" prologue, the
    // exports marker, blank lines. Nothing executable.
    const meaningful = emitted
      .replace(/^\s*['"]use strict['"];?\s*$/gm, '')
      .replace(/^\s*Object\.defineProperty\(exports, ["']__esModule["'].*$/gm, '')
      .replace(/^\s*exports\.\w+ = void 0;\s*$/gm, '')
      .trim();

    return meaningful.length === 0;
  } catch {
    return false;
  }
}

module.exports = { emitsNoJavaScript };
