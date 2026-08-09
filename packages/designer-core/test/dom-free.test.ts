import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { builtModuleList, ensureDesignerCoreBuilt } from './helpers/build-artifact';

/**
 * The DOM-free proof for `@jumentix/designer-core` (JUM-493).
 *
 * The issue's acceptance bar: a "framework-free core" that still imports DOM
 * helpers, calls `alert()`, or reaches for `localStorage` is not
 * framework-free — it is the designer with a package.json. The check is
 * mechanical, and it runs on the BUILT ARTIFACT, not on the source tree, so
 * what is proven is exactly what would be published.
 *
 * Two complementary scans, both AST-based (comments mention `window.alert`
 * and `localStorage` to explain their absence — a text scan cannot tell the
 * difference, the compiler can):
 *
 * 1. **No DOM globals.** No file in `dist/` references `window`, `document`,
 *    `localStorage`, `sessionStorage`, `indexedDB`, `alert`, `confirm`,
 *    `prompt`, `DOMParser` or `FileReader` — unless the identifier is a
 *    locally declared binding shadowing the global (the AsyncAPI validator
 *    names its parameter `document`, because that is what the spec calls the
 *    input).
 * 2. **No boundary-crossing imports.** Every module specifier in `dist/`
 *    resolves inside `dist/`; nothing imports the sync clients, the storage
 *    adapters, Cana, or any DOM module.
 */

const packageRoot = path.resolve(__dirname, '..');

const FORBIDDEN_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'alert',
  'confirm',
  'prompt',
  'DOMParser',
  'FileReader'
]);

/** Modules the issue puts on the other side of the package boundary. */
const EXCLUDED_MODULE_MARKERS = [
  'designerSync',
  'catalogSyncClient',
  'CanaDesignerStore',
  'canaMigration',
  'designerStoreFactory',
  '/ui/',
  '/pwa/'
];

/** Whether a module specifier is relative — resolvable inside the artifact. */
const isRelativeSpecifier = (specifier: string): boolean => specifier.startsWith('./')
  || specifier.startsWith('../');

/** Whether `name` is declared anywhere between `node` and the module root. */
function isLocallyBound(node: ts.Node, name: string): boolean {
  const declares = (statement: ts.Statement): boolean => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
      );
    }
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      return statement.name?.text === name;
    }
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name?.text === name) return true;
      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        return named.elements.some((element) => element.name.text === name);
      }
      if (named && ts.isNamespaceImport(named)) return named.name.text === name;
    }
    return false;
  };

  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isSourceFile(current)) return current.statements.some(declares);
    if (ts.isFunctionDeclaration(current)
      || ts.isFunctionExpression(current)
      || ts.isArrowFunction(current)
      || ts.isMethodDeclaration(current)
      || ts.isConstructorDeclaration(current)
      || ts.isGetAccessorDeclaration(current)
      || ts.isSetAccessorDeclaration(current)) {
      if (current.parameters.some((parameter) => ts.isIdentifier(parameter.name)
        && parameter.name.text === name)) {
        return true;
      }
      const functionName = (current as { name?: ts.Node }).name;
      if (functionName && ts.isIdentifier(functionName) && functionName.text === name) return true;
    }
    if (ts.isBlock(current) || ts.isModuleBlock(current)) {
      if (current.statements.some(declares)) return true;
    }
    if (ts.isCaseBlock(current)) {
      if (current.clauses.some((clause) => clause.statements.some(declares))) return true;
    }
    if (ts.isCatchClause(current) && current.variableDeclaration) {
      const { name: declarationName } = current.variableDeclaration;
      if (ts.isIdentifier(declarationName) && declarationName.text === name) return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Whether this occurrence of the identifier reads the global. Property names
 * (`obj.window`), object-literal keys and export alias names are not reads.
 */
function isGlobalRead(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isExportSpecifier(parent) && parent.name === node && parent.propertyName) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  return true;
}

function collectDomReferences(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const hits: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text) && isGlobalRead(node)) {
      if (!isLocallyBound(node, node.text)) {
        const { line, character } = ts.getLineAndCharacterOfPosition(source, node.getStart(source));
        hits.push(`${path.basename(file)}:${line + 1}:${character + 1} references global \`${node.text}\``);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

function collectModuleSpecifiers(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

describe('designer-core is framework-free (JUM-493)', () => {
  beforeAll(async () => {
    await ensureDesignerCoreBuilt(packageRoot);
  }, 180_000);

  it('references no DOM global anywhere in the built artifact', () => {
    expect.hasAssertions();
    const modules = [...builtModuleList(packageRoot), 'index.js'];
    const hits = modules.flatMap((rel) => collectDomReferences(path.join(packageRoot, 'dist', rel)));

    // The assertion message IS the audit trail: a hit names the file, the
    // position and the global, so a violation fails saying exactly which
    // module crossed the boundary.
    expect(hits).toStrictEqual([]);
  });

  it('imports nothing from outside the package boundary', () => {
    expect.hasAssertions();
    const modules = [...builtModuleList(packageRoot), 'index.js'];
    let specifierCount = 0;

    for (const rel of modules) {
      const file = path.join(packageRoot, 'dist', rel);
      for (const specifier of collectModuleSpecifiers(file)) {
        specifierCount += 1;
        // Relative, and resolving inside dist/: the artifact is self-contained.
        expect(isRelativeSpecifier(specifier)).toBe(true);
        const resolved = path.resolve(path.dirname(file), specifier);
        expect(resolved.startsWith(path.join(packageRoot, 'dist'))).toBe(true);
        // None of the modules the issue excludes, and never Cana.
        for (const marker of EXCLUDED_MODULE_MARKERS) {
          expect(specifier).not.toContain(marker);
        }
        expect(specifier.toLowerCase()).not.toContain('cana');
      }
    }

    // A scan that found no specifiers at all proves nothing.
    expect(specifierCount).toBeGreaterThan(0);
  });
});
