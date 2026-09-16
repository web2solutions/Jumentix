import { describe, expect, it } from 'bun:test';

import { formatApiError, isNotFoundError } from '@/contracts/errors';

import { setLocale } from '@/i18n';

const apiError = (status: number, body: unknown) => (
  new Error(`REST request failed: ${status} ${typeof body === 'string' ? body : JSON.stringify(body)}`)
);

setLocale('pt-BR');

describe('formatApiError (JUM-765)', () => {
  it('keeps the backend message on 400', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(400, { message: 'username can not be empty' })))
      .toBe('username can not be empty');
  });

  it('maps 401 to an expired-session message', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(401, {}))).toBe('Sessão expirada — faça login novamente.');
  });

  it('maps 403 to a permission message', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(403, {}))).toBe('Você não tem permissão para esta operação.');
  });

  it('maps 404 to a not-found message', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(404, {}))).toBe('Registro não encontrado — a lista foi atualizada.');
  });

  it('maps 5xx to a server-error message', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(500, { message: '' }))).toBe('Erro interno do servidor — tente novamente em instantes.');
  });

  it('detects 404 errors for the benign-delete path', () => {
    expect.assertions(2);
    expect(isNotFoundError(apiError(404, {}))).toBe(true);
    expect(isNotFoundError(apiError(403, {}))).toBe(false);
  });

  it('passes through messages that are not SDK failures', () => {
    expect.assertions(2);
    expect(formatApiError(new Error('plain boom'))).toBe('plain boom');
    expect(formatApiError('string failure')).toBe('string failure');
  });

  it('keeps a non-JSON backend body as the message', () => {
    expect.assertions(1);
    expect(formatApiError(apiError(400, 'duplicate username'))).toBe('duplicate username');
  });

  it('keeps the backend message on 409 conflicts', () => {
    expect.assertions(2);
    expect(formatApiError(apiError(409, { message: 'username already exists' }))).toBe('username already exists');
    expect(formatApiError(apiError(409, {}))).toBe('Conflito com o estado atual do registro.');
  });

  it('falls back to a generic message for unmapped statuses', () => {
    expect.assertions(2);
    expect(formatApiError(apiError(418, { message: 'I am a teapot' }))).toBe('I am a teapot');
    expect(formatApiError(apiError(302, {}))).toBe('Falha na requisição (302).');
  });
});
