/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'fs';
import path from 'path';

const CANONICAL_HTTP_FRAMEWORKS = [
  'express',
  'fastify',
  'restify',
  'cloudflare-workers',
  'vercel-functions',
  'loopback',
  'sails-js',
  'feathers',
  'derby-js',
  'adonis-js',
  'total-js'
];

const enumValuesFor = (scriptSource: string, key: string): string[] => {
  const match = scriptSource.match(new RegExp(`${key}: \\[([^\\]]*)\\]`));
  if (!match) throw new Error(`enum for ${key} not found in script.js`);
  return Array.from(match[1].matchAll(/'([^']*)'/g), (m) => m[1]);
};

const hintsBlock = (scriptSource: string): string => {
  const match = scriptSource.match(/RUNTIME_ENV_FIELD_HINTS = \{([\s\S]*?)\};/);
  if (!match) throw new Error('RUNTIME_ENV_FIELD_HINTS not found in script.js');
  return match[1];
};

describe('service management runtime env UI contract (JUM-461)', () => {
  const scriptPath = path.resolve(process.cwd(), 'apps/service-management/script.js');
  const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');

  it('labels every rendered field with the key it actually writes', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    // The dynamic renderer names each field after its own env key — a field can
    // never write a key other than the one its label shows.
    expect(script).toContain('label.textContent = isEditable ? key :');
    // The realtime driver carries its own context hint, distinct from the main one.
    const hint = hintsBlock(script).match(/JUMENTIX_REALTIME_API_DATABASE_DRIVER: '([^']+)'/);
    expect(hint).not.toBeNull();
    expect(hint![1]).toContain('Realtime');
  });

  it('exposes the main database driver as a separately editable key with its own hint', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const values = enumValuesFor(script, 'JUMENTIX_DATABASE_DRIVER');
    expect(values).toContain('InMemory');
    expect(values).toContain('Mongo');
    expect(values).not.toContain('MS SQL');
    const hint = hintsBlock(script).match(/JUMENTIX_DATABASE_DRIVER: '([^']+)'/);
    expect(hint).not.toBeNull();
    expect(hint![1]).toContain('Main application database');
  });

  it('offers exactly the canonical HTTP framework set, without aliases', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const values = enumValuesFor(script, 'JUMENTIX_HTTP_FRAMEWORK');
    expect(values).toStrictEqual(CANONICAL_HTTP_FRAMEWORKS);
    expect(values).not.toContain('derby');
    expect(values).not.toContain('sails');
    expect(values).not.toContain('hyper-express');
  });

  it('keeps every UI-offered framework inside the backend accepted set', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const runtimeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts'),
      'utf-8'
    );
    enumValuesFor(script, 'JUMENTIX_HTTP_FRAMEWORK').forEach((value) => {
      expect(runtimeSource).toContain(`'${value}'`);
    });
  });

  it('round-trips both driver keys through script.js and the server allowlist', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const server = fs.readFileSync(serverPath, 'utf-8');
    // The save path collects every rendered editable field by its own key.
    expect(script).toContain('querySelectorAll(\'[data-runtime-key]\')');
    expect(script).toContain('values[key] = field.value');
    expect(server).toContain('\'JUMENTIX_DATABASE_DRIVER\'');
    expect(server).toContain('\'JUMENTIX_REALTIME_API_DATABASE_DRIVER\'');
  });
});
