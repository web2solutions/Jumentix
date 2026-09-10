/**
 * Human-readable mapping of the SDK's `REST request failed: <status> <body>`
 * errors (JUM-765). Backend error messages are preserved when present.
 */
export const formatApiError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const match = /REST request failed: (\d{3})\s*(.*)/s.exec(message);
  if (!match) {
    return message;
  }
  const status = Number(match[1]);
  let backendMessage = '';
  try {
    const parsed = JSON.parse(match[2] || '{}') as { message?: string };
    backendMessage = parsed.message ?? '';
  } catch {
    backendMessage = match[2]?.slice(0, 120) ?? '';
  }

  switch (status) {
    case 400:
      return backendMessage || 'Dados inválidos — verifique os campos do formulário.';
    case 401:
      return 'Sessão expirada — faça login novamente.';
    case 403:
      return 'Você não tem permissão para esta operação.';
    case 404:
      return 'Registro não encontrado — a lista foi atualizada.';
    case 409:
      return backendMessage || 'Conflito com o estado atual do registro.';
    default:
      if (status >= 500) {
        return 'Erro interno do servidor — tente novamente em instantes.';
      }
      return backendMessage || `Falha na requisição (${status}).`;
  }
};

export const isNotFoundError = (error: unknown): boolean => (
  error instanceof Error && /REST request failed: 404(\s|$)/.test(error.message)
);
