import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { candidateSpecPaths, loadCanonicalSpec } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The three SDK packages resolve their canonical OpenAPI/AsyncAPI documents
 * with the same walk-up: look in `spec/` next to the module, then walk
 * ancestors until one has the artifact. That logic used to live, copied, in
 * three packages — and every copy behaved identically because each was written
 * to look identical, which is exactly the shape of code that drifts.
 *
 * `loadCanonicalSpec` is the single implementation. Its branches are the ones
 * the SDKs exercise on every load: an explicit base path, a document found by
 * walking up from the module directory, and the failure when neither exists.
 */

const scratch = (suffix: string) => fs.mkdtempSync(path.join(os.tmpdir(), `shared-contracts-${suffix}-`));

describe('candidateSpecPaths', () => {
  it('walks from the module directory to the filesystem root', () => {
    expect.hasAssertions();

    const base = scratch('walk');
    const nested = path.join(base, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });

    const candidates = candidateSpecPaths(nested, ['asyncapi', '1.0.0.grpc.yml']);

    expect(candidates[0]).toBe(path.join(nested, 'spec', 'asyncapi', '1.0.0.grpc.yml'));
    expect(candidates).toContain(path.join(base, 'spec', 'asyncapi', '1.0.0.grpc.yml'));
    expect(candidates[candidates.length - 1]).toBe(
      path.join(path.parse(base).root, 'spec', 'asyncapi', '1.0.0.grpc.yml')
    );
  });
});

describe('loadCanonicalSpec', () => {
  it('parses the document from the base path it is given', () => {
    expect.hasAssertions();

    const base = scratch('base');
    fs.mkdirSync(path.join(base, 'asyncapi'));
    fs.writeFileSync(
      path.join(base, 'asyncapi', '1.0.0.grpc.yml'),
      'servers:\n  local:\n    host: example.test:9999\n',
      'utf8'
    );

    expect(loadCanonicalSpec({
      basePath: base,
      moduleDirectory: __dirname,
      specSegments: ['asyncapi', '1.0.0.grpc.yml'],
      artifactLabel: 'AsyncAPI gRPC spec'
    })).toStrictEqual({ servers: { local: { host: 'example.test:9999' } } });
  });

  it('finds a spec in a sibling package directory when no base path is given', () => {
    expect.hasAssertions();

    // The repository ships `spec/` at the root; walking up from any package
    // directory finds it without needing the caller to know where the root is.
    const resolved = loadCanonicalSpec({
      moduleDirectory: path.join(process.cwd(), 'packages', 'shared-contracts', 'src'),
      specSegments: ['asyncapi', '1.0.0.grpc.yml'],
      artifactLabel: 'AsyncAPI gRPC spec'
    });

    expect(resolved).toBeDefined();
  });

  it('fails when the base path has no spec document', () => {
    expect.hasAssertions();

    expect(() => loadCanonicalSpec({
      basePath: scratch('empty'),
      moduleDirectory: __dirname,
      specSegments: ['1.0.0.yml'],
      artifactLabel: 'OpenAPI spec'
    })).toThrow(/ENOENT/);
  });

  it('fails when no canonical spec exists above the module directory', () => {
    expect.hasAssertions();

    // An isolated directory under the OS temp root has no `spec/` anywhere
    // above it, so the walk-up finds nothing.
    expect(() => loadCanonicalSpec({
      moduleDirectory: scratch('nothing'),
      specSegments: ['asyncapi', '1.0.0.grpc.yml'],
      artifactLabel: 'AsyncAPI gRPC spec'
    })).toThrow(/1\.0\.0\.grpc\.yml/);
  });
});
