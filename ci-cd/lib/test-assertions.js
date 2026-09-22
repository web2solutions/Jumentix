/**
 * Per-test assertion declarations (JUM-702).
 *
 * The textual rule this replaces asked one question of a whole file: does the
 * string `expect.hasAssertions()` appear anywhere in it? That catches a suite
 * arriving with none — which is how all 31 files in JUM-677 got in — and misses
 * a single test losing its own, which is what a refactor actually does. The
 * JUM-683 verification showed exactly that: removing one declaration from a file
 * that still had others did not trip the gate.
 *
 * Answering it per test needs a parse, because the question is which *function
 * body* contains the declaration, and a regex has no idea where a body ends.
 * TypeScript's own parser is already a dependency, handles `.tsx`, and does not
 * need a type-checker for this — `createSourceFile` alone is enough.
 *
 * A declaration counts for a test when it is inside that test's own body, or
 * inside a `beforeEach`/`beforeAll` of an enclosing `describe`. The second case
 * is not a loophole: a hook that runs before every test declares for every test
 * as surely as the line would.
 */
const fs = require('fs');
const ts = require('typescript');

/** `it`, `test`, and their modifier chains: `it.each(...)`, `test.concurrent`. */
const TEST_CALLEES = new Set(['it', 'test', 'fit']);
const SUITE_CALLEES = new Set(['describe', 'suite', 'fdescribe']);
const HOOK_CALLEES = new Set(['beforeEach', 'beforeAll']);

/** Modifiers that mean no body runs, so there is nothing to declare. */
const NO_BODY_MODIFIERS = new Set(['todo', 'skip', 'concurrent.skip']);

/**
 * The identifier a call expression ultimately hangs off.
 *
 * `it.each([...])('name', fn)` is a call whose callee is a call whose callee is
 * a property access on `it`. Unwrapping to the root identifier is what makes the
 * modifier chains work without enumerating them.
 */
function rootName(expression) {
  let node = expression;
  const modifiers = [];
  for (;;) {
    if (ts.isCallExpression(node)) { node = node.expression; continue; }
    if (ts.isPropertyAccessExpression(node)) {
      modifiers.unshift(node.name.getText ? node.name.getText() : node.name.escapedText);
      node = node.expression;
      continue;
    }
    break;
  }
  if (!ts.isIdentifier(node)) return null;
  return { name: node.escapedText.toString(), modifiers };
}

function bodyOf(call) {
  for (const argument of call.arguments) {
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) return argument;
  }
  return null;
}

function titleOf(call) {
  const [first] = call.arguments;
  if (!first) return '<unnamed>';
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) return first.text;
  return first.getText().slice(0, 60);
}

/** `expect.hasAssertions()` or `expect.assertions(n)` anywhere inside `node`. */
function declaresAssertions(node) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)) {
      const method = child.expression.name.escapedText.toString();
      const target = child.expression.expression;
      if (
        (method === 'hasAssertions' || method === 'assertions')
        && ts.isIdentifier(target)
        && target.escapedText.toString() === 'expect'
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

/**
 * Every test in the source that does not declare that it asserts.
 *
 * Returns `{ title, line }` per finding. The line is what makes the failure
 * actionable — a file name alone sends the reader looking through 40 tests for
 * the one that lost its declaration.
 */
function testsWithoutDeclarations(source, fileName = 'suite.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const findings = [];

  /** `declaredByHook` is true when an enclosing describe declares in a hook. */
  const visit = (node, declaredByHook) => {
    if (ts.isCallExpression(node)) {
      const root = rootName(node.expression);
      const body = bodyOf(node);

      if (root && SUITE_CALLEES.has(root.name) && body) {
        // Hooks are read before the tests they precede, whatever their order in
        // the file: a `beforeEach` at the bottom still runs before every test.
        let inherited = declaredByHook;
        ts.forEachChild(body.body || body, (child) => {
          if (!ts.isExpressionStatement(child) || !ts.isCallExpression(child.expression)) return;
          const hook = rootName(child.expression.expression);
          if (!hook || !HOOK_CALLEES.has(hook.name)) return;
          const hookBody = bodyOf(child.expression);
          if (hookBody && declaresAssertions(hookBody)) inherited = true;
        });
        visit(body, inherited);
        return;
      }

      if (root && TEST_CALLEES.has(root.name)) {
        const skipped = root.modifiers.some((modifier) => NO_BODY_MODIFIERS.has(modifier));
        if (!skipped && body && !declaredByHook && !declaresAssertions(body)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          findings.push({ title: titleOf(node), line: line + 1 });
        }
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, declaredByHook));
  };

  visit(sourceFile, false);
  return findings;
}

function testsWithoutDeclarationsInFile(absolutePath) {
  return testsWithoutDeclarations(fs.readFileSync(absolutePath, 'utf8'), absolutePath);
}

module.exports = { declaresAssertions, testsWithoutDeclarations, testsWithoutDeclarationsInFile };
