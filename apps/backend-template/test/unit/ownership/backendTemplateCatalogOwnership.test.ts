import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const repoRoot = path.resolve(__dirname, '../../../../..');

const forbiddenRuntimePaths = [
  'apps/backend-template/src/modules/Catalogs',
  'apps/backend-template/src/infra/persistence/InMemoryDatabase/Stores/CatalogStoreAPI.ts',
  'apps/backend-template/test/unit/modules/Catalogs',
  'apps/backend-template/test/integration/Express/Catalogs'
];

describe('backend-template catalog ownership boundary', () => {
  it('does not ship Service Management catalog runtime or tests', () => {
    expect.hasAssertions();
    for (const relativePath of forbiddenRuntimePaths) {
      expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(false);
    }
  });

  it('does not expose platform-owned /catalogs routes in the generated-service OAS', () => {
    expect.hasAssertions();
    const spec = YAML.parse(fs.readFileSync(path.join(repoRoot, 'spec/1.0.0.yml'), 'utf8'));
    const pathNames = Object.keys(spec.paths);
    expect(pathNames).not.toContain('/catalogs');
    expect(pathNames).not.toContain('/catalogs/{id}');
    expect(pathNames).not.toContain('/catalogs/{id}/restore');
  });

  it('does not grant catalog-specific scopes from template roles', async () => {
    expect.hasAssertions();
    const { ROLE_SCOPE_MATRIX } = await import('@src/modules/Users/domain/security/Rbac');
    const scopes = Object.values(ROLE_SCOPE_MATRIX).flat();
    expect(scopes.filter((scope) => String(scope).includes('catalog'))).toStrictEqual([]);
  });
});
