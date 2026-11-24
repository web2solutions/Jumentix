/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/* eslint-disable jest/no-conditional-in-test, max-len, @typescript-eslint/no-require-imports */

/**
 * Backend-template seed — first-run model generated from spec/1.0.0.yml.
 *
 * Pins:
 * - Generator writes a Users domain with stable ids across two runs.
 * - Normalized seed has zero collectModelIssues (export gate).
 * - Vendor script chain references the generator.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeStatePayload } from '@jumentix/designer-core/state/designerState.js';
import { collectModelIssues } from '@jumentix/designer-core/validation/modelValidation.js';
import {
  generateBackendTemplateSeed,
  OUT_JSON_REL,
  OUT_EMBED_REL
} from '../../scripts/generate-backend-template-seed.js';
import { buildBackendTemplateSeedPayload } from '../../src/model/backendTemplateSeed.js';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('backend-template seed', () => {
  it('generates a Users domain with deterministic ids across two runs', () => {
    expect.hasAssertions();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-seed-'));
    try {
      // Mirror the OAS + Users module layout the generator expects.
      const specDir = path.join(tempRoot, 'spec');
      const modulesDir = path.join(tempRoot, 'apps', 'backend-template', 'src', 'modules', 'Users');
      fs.mkdirSync(specDir, { recursive: true });
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.mkdirSync(
        path.join(tempRoot, 'apps', 'backend-template', 'src', 'modules', 'ddd'),
        { recursive: true }
      );
      fs.copyFileSync(
        path.join(repoRoot, 'spec', '1.0.0.yml'),
        path.join(specDir, '1.0.0.yml')
      );

      const code1 = generateBackendTemplateSeed({ root: tempRoot });
      expect(code1).toBe(0);
      const first = JSON.parse(
        fs.readFileSync(path.join(tempRoot, OUT_JSON_REL), 'utf8')
      );

      const code2 = generateBackendTemplateSeed({ root: tempRoot });
      expect(code2).toBe(0);
      const second = JSON.parse(
        fs.readFileSync(path.join(tempRoot, OUT_JSON_REL), 'utf8')
      );

      expect(first.domains.length).toBeGreaterThanOrEqual(1);
      expect(first.domains.some(
        (domain: { name: string }) => domain.name === 'Users'
      )).toBe(true);
      expect(first).toStrictEqual(second);
      expect(first.domains[0].id).toBe('backend-domain-users');
      expect(fs.existsSync(path.join(tempRoot, OUT_EMBED_REL))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('embeds a seed that normalizes with zero model issues', () => {
    expect.hasAssertions();
    const payload = buildBackendTemplateSeedPayload();
    expect(payload.domains.some(
      (domain: { name: string }) => domain.name === 'Users'
    )).toBe(true);
    const state = normalizeStatePayload(payload);
    expect(collectModelIssues(state)).toStrictEqual([]);
  });

  it('packs entity cards without overlap so relationships have corridor space', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      entityWidth,
      entityHeight
    } = require('@jumentix/designer-core/model/modelQueries.js');
    const payload = buildBackendTemplateSeedPayload();
    const users = payload.domains.find(
      (domain: { name: string }) => domain.name === 'Users'
    );
    expect(users).toBeTruthy();
    const entities = users.entities as Array<{ x: number; y: number }>;
    expect(entities.length).toBeGreaterThanOrEqual(6);
    const boxes = entities.map((entity) => ({
      left: entity.x,
      top: entity.y,
      right: entity.x + entityWidth(entity),
      bottom: entity.y + entityHeight(entity, false, false)
    }));
    const header = 50;
    const pairs: Array<[typeof boxes[0], typeof boxes[0]]> = [];
    boxes.forEach((box, index) => {
      expect(box.right).toBeLessThanOrEqual(users.width - 56);
      // Entity y is body-relative — must fit under domain.height − header.
      expect(box.bottom).toBeLessThanOrEqual(users.height - header - 56);
      boxes.slice(index + 1).forEach((other) => {
        pairs.push([box, other]);
      });
    });
    pairs.forEach(([box, other]) => {
      const separatedX = box.right <= other.left || box.left >= other.right;
      const separatedY = box.bottom <= other.top || box.top >= other.bottom;
      expect(separatedX || separatedY).toBe(true);
    });
    // Prefer two columns so vertical corridors exist (not a side-only 3-col pack).
    const xs = new Set(entities.map((entity) => entity.x));
    expect(xs.size).toBeLessThanOrEqual(2);
  });

  it('is wired into service-management:vendor', () => {
    expect.hasAssertions();
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );
    const vendor = String(packageJson.scripts['service-management:vendor']);
    expect(vendor).toContain('generate-backend-template-seed.js');
    expect(fs.existsSync(path.join(
      repoRoot,
      'apps/service-management/generated/backend-template-seed.json'
    ))).toBe(true);
  });
});
