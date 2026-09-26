import {
  DATABASE_CONFLICT_ERROR_NAME,
  DATABASE_NOT_FOUND_ERROR_NAME,
  DATABASE_PAGING_ERROR,
  DOMAIN_NOT_FOUND_ERROR_NAME,
  DOMAIN_VALIDATION_ERROR_NAME,
  EVENT_INVALID_MESSAGE,
  FORBIDDEN_ERROR_NAME,
  INFRA_NOT_IMPLEMENTED,
  LOCKED_RESOURCE_ERROR_NAME,
  NOT_FOUND_ERROR_NAME,
  UNAUTHORIZED_ERROR_NAME,
  VALIDATION_ERROR_NAME
} from '@src/config/constants';
import { EErrorNumberCodes } from '@src/infra/exceptions';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';

export function replaceVars(path: string): string {
  return path.toString().replace(/{/g, ':').replace(/}/g, '');
}

export function toHttpStatus(stringCode: EErrorStringCodes): number {
  return EErrorNumberCodes[stringCode as any] as unknown as number;
}

export function formatErrorMessage(error: BaseError) {
  let message = '';
  if (
    error.name === VALIDATION_ERROR_NAME ||
    error.name === DOMAIN_VALIDATION_ERROR_NAME ||
    error.name === EVENT_INVALID_MESSAGE ||
    error.name === DATABASE_PAGING_ERROR
  ) {
    message = `Bad Request - ${error.message}`;
  } else if (error.name === FORBIDDEN_ERROR_NAME) {
    message = `Forbidden - ${error.message}`;
  } else if (error.name === UNAUTHORIZED_ERROR_NAME) {
    message = `Unauthorized - ${error.message}`;
  } else if (error.name === LOCKED_RESOURCE_ERROR_NAME) {
    message = `Locked - ${error.message}`;
  } else if (
    error.name === NOT_FOUND_ERROR_NAME ||
    error.name === DOMAIN_NOT_FOUND_ERROR_NAME ||
    error.name === DATABASE_NOT_FOUND_ERROR_NAME
  ) {
    message = `Not Found - ${error.message}`;
  } else if (error.name === DATABASE_CONFLICT_ERROR_NAME) {
    message = `Conflict - ${error.message}`;
  } else if (error.name === INFRA_NOT_IMPLEMENTED) {
    message = `Not Implemented - ${error.message}`;
  }

  return message;
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  return nodeEnv === 'prod' || nodeEnv === 'production';
}

export function shouldExposeInternalErrors(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isProductionEnv(env);
}

export function buildErrorResponsePayload(
  error: BaseError,
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    message: formatErrorMessage(error),
    correlationId: error.correlationId || undefined
  };
  if (shouldExposeInternalErrors(env)) {
    payload.error = error;
  }
  return payload;
}
