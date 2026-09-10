import { describe, expect, it } from 'bun:test';

import { formatApiError, isNotFoundError } from '@/contracts/errors';

const apiError = (status: number, body: unknown) => (
  new Error(`REST request failed: ${status} ${typeof body === 'string' ? body : JSON.stringify(body)}`)
);

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
});
