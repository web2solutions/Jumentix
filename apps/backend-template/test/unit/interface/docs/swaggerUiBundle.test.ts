import fs from 'node:fs';
import path from 'node:path';

/**
 * JUM-907: /OASdoc and the Service Management OpenAPI tab shipped swagger-ui
 * 3.20.3, which rejects every Jumentix contract with "Supported version fields
 * are swagger: "2.0" and those that match openapi: 3.0.n" — the contracts are
 * OpenAPI 3.1 (Requirement 026). OpenAPI 3.1 rendering starts at swagger-ui 5.
 */
const repoRoot = path.resolve(__dirname, '../../../../../..');

function bundledVersion(relative: string): number[] {
  const source = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
  const match = source.match(/version:"(\d+)\.(\d+)\.(\d+)"/);
  expect(match).not.toBeNull();
  return (match as RegExpMatchArray).slice(1).map(Number);
}

describe('vendored Swagger UI renders OpenAPI 3.1 (JUM-907)', () => {
  it('ships a swagger-ui major that supports OpenAPI 3.1 at /OASdoc', () => {
    expect.hasAssertions();
    const [major] = bundledVersion('apps/backend-template/OASdoc/swagger-ui-bundle.js');

    expect(major).toBeGreaterThanOrEqual(5);
  });

  it('serves a contract the bundle can render', () => {
    expect.hasAssertions();
    const spec = fs.readFileSync(path.join(repoRoot, 'spec/1.0.0.yml'), 'utf8');

    expect(spec.split('\n')[0]).toBe('openapi: 3.1.0');
  });
});
