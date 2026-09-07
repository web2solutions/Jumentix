/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the `IDesignerStore` port contract (JUM-468) and the
 * JUM-484 retirement guarantees: Cana is the SOLE designer store, the
 * transitional `LocalStorageDesignerStore` is deleted, and no runtime path
 * falls back to localStorage (decision 2026-07-29).
 *
 * Adapter behaviour itself is covered by `canaDesignerStore.test.ts` (the
 * sole implementation) and `canaMigration.test.ts` (the one-way migration
 * that retired the localStorage path). The suite runs with no DOM — the
 * port never touches one.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const storeDir = path.join(repoRoot, 'apps', 'service-management', 'src', 'store');
const {
  IDesignerStore
} = require('@jumentix/designer-core/store/IDesignerStore.js');

describe('designer store port contract (JUM-468)', () => {
  it('fails loudly when an adapter does not override a method', async () => {
    expect.hasAssertions();
    const port = new IDesignerStore();
    await expect(port.probe()).rejects.toThrow('IDesignerStore.probe()');
    await expect(port.load()).rejects.toThrow('IDesignerStore.load()');
    await expect(port.save({})).rejects.toThrow('IDesignerStore.save()');
    await expect(port.clear()).rejects.toThrow('IDesignerStore.clear()');
    await expect(port.loadBaseline()).rejects.toThrow('IDesignerStore.loadBaseline()');
    await expect(port.saveBaseline({})).rejects.toThrow('IDesignerStore.saveBaseline()');
    await expect(port.clearBaseline()).rejects.toThrow('IDesignerStore.clearBaseline()');
  });

  it('documents the Cana-shaped semantics the port must carry', () => {
    expect.hasAssertions();
    // The port's canonical home is the publishable package (JUM-493).
    const source = fs.readFileSync(
      path.join(repoRoot, 'packages', 'designer-core', 'src', 'store', 'IDesignerStore.js'),
      'utf-8'
    );
    // The four load outcomes and the two save outcomes are contract terms.
    ['\'ok\'', '\'empty\'', '\'unavailable\'', '\'lost\'', '\'persisted\'', '\'unknown\''].forEach((term) => {
      expect(source).toContain(term);
    });
    // The no-fallback decision and the sole-store retirement are stated.
    expect(source).toContain('JUM-484');
    expect(source).toContain('SOLE');
  });
});

describe('localStorage retirement (JUM-484, no fallback — decision 2026-07-29)', () => {
  it('deletes the transitional LocalStorageDesignerStore module', () => {
    expect.hasAssertions();
    expect(fs.existsSync(path.join(storeDir, 'LocalStorageDesignerStore.js'))).toBe(false);
  });

  it('leaves Cana as the only store module beside the factory and migration', () => {
    expect.hasAssertions();
    // The port itself moved to the publishable package (JUM-493); the app
    // keeps only the Cana-facing side.
    const modules = fs.readdirSync(storeDir).filter((entry) => entry.endsWith('.js')).sort();
    expect(modules).toStrictEqual([
      'CanaDesignerStore.js',
      'canaMigration.js',
      'designerStoreFactory.js'
    ]);
  });

  it('keeps localStorage out of every runtime store path except the migration source', () => {
    expect.hasAssertions();
    // The ONLY module allowed to mention localStorage is the one-way
    // migration, which reads the legacy payload as a SOURCE — never as a
    // store the designer can fall back to. The port lives in the package.
    const runtimeModules: Array<[string, string]> = [
      [path.join(repoRoot, 'packages', 'designer-core', 'src', 'store'), 'IDesignerStore.js'],
      [storeDir, 'CanaDesignerStore.js'],
      [storeDir, 'designerStoreFactory.js']
    ];
    runtimeModules.forEach(([dir, moduleName]) => {
      const source = fs.readFileSync(path.join(dir, moduleName), 'utf-8');
      expect(source).not.toContain('getItem');
      expect(source).not.toContain('setItem');
      expect(source).not.toContain('removeItem');
      expect(source).not.toMatch(/new\s+LocalStorageDesignerStore/);
    });
  });

  it('removes the retired driver-selection surface from the factory', () => {
    expect.hasAssertions();
    const factory = require(path.join(storeDir, 'designerStoreFactory.js'));
    expect(factory.DEFAULT_DESIGNER_STORE_DRIVER).toBeUndefined();
    expect(factory.normalizeDesignerStoreDriver).toBeUndefined();
    expect(factory.resolveDesignerStoreDriver).toBeUndefined();
    expect(typeof factory.createDesignerStore).toBe('function');
  });
});
