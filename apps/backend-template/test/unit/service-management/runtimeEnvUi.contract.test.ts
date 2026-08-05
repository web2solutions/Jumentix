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

const selectBlock = (html: string, selectId: string): string => {
  const match = html.match(new RegExp(`<select id="${selectId}">[\\s\\S]*?</select>`));
  if (!match) throw new Error(`select #${selectId} not found`);
  return match[0];
};

const optionValues = (selectHtml: string): string[] => Array.from(
  selectHtml.matchAll(/<option value="([^"]+)">/g),
  (match) => match[1]
);

describe('service management runtime env UI contract (JUM-461)', () => {
  const indexPath = path.resolve(process.cwd(), 'apps/service-management/index.html');
  const scriptPath = path.resolve(process.cwd(), 'apps/service-management/script.js');
  const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');

  it('labels the realtime driver select with the key it actually writes', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain(
      '<label for="runtime-realtime-db-driver-select">JUMENTIX_REALTIME_API_DATABASE_DRIVER</label>'
    );
  });

  it('exposes the main database driver as a separately labelled select', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('<label for="runtime-db-driver-select">JUMENTIX_DATABASE_DRIVER</label>');
    const values = optionValues(selectBlock(html, 'runtime-db-driver-select'));
    expect(values).toContain('InMemory');
    expect(values).toContain('Mongo');
    expect(values).not.toContain('MS SQL');
  });

  it('offers exactly the canonical HTTP framework set, without aliases', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    const values = optionValues(selectBlock(html, 'runtime-http-framework-select'));
    expect(values).toStrictEqual(CANONICAL_HTTP_FRAMEWORKS);
    expect(values).not.toContain('derby');
    expect(values).not.toContain('sails');
    expect(values).not.toContain('hyper-express');
  });

  it('keeps every UI-offered framework inside the backend accepted set', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    const runtimeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts'),
      'utf-8'
    );
    optionValues(selectBlock(html, 'runtime-http-framework-select')).forEach((value) => {
      expect(runtimeSource).toContain(`'${value}'`);
    });
  });

  it('round-trips both driver keys through script.js and the server allowlist', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const server = fs.readFileSync(serverPath, 'utf-8');
    expect(script).toContain('runtimeDbDriverSelect: document.getElementById(\'runtime-db-driver-select\')');
    expect(script).toContain('JUMENTIX_DATABASE_DRIVER: dom.runtimeDbDriverSelect?.value');
    expect(script).toContain('JUMENTIX_REALTIME_API_DATABASE_DRIVER: dom.runtimeRealtimeDbDriverSelect?.value');
    expect(server).toContain('\'JUMENTIX_DATABASE_DRIVER\'');
    expect(server).toContain('\'JUMENTIX_REALTIME_API_DATABASE_DRIVER\'');
  });
});
