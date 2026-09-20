import { OpenAPIV3 } from 'openapi-types';
import { ValidationError } from '@src/infra/exceptions';
import { validateValueAgainstOpenApiSchema } from '@src/shared/openapi/OpenApi31DataEntity';
import getSchema from './getSchema';
import isPropertiesMatching from './isPropertiesMatching';
import checkRequiredProperties from './checkRequiredProperties';

const SERVER_MANAGED_INPUT_PROPERTIES = new Set(['createdAt', 'updatedAt', 'deletedAt']);

const toPublicValidationMessage = (
  message: string,
  payload: unknown,
  operationId?: string
): string => {
  const fieldMatch = message.match(/payload\.([A-Za-z0-9_]+)/);
  const fieldName = fieldMatch?.[1];
  if (!fieldName || typeof payload !== 'object' || payload === null) {
    return message;
  }

  const fieldValue = (payload as Record<string, unknown>)[fieldName];
  if (fieldValue === '' && (
    message.includes('minLength')
    || message.includes('value must be one of')
  )) {
    if (
      fieldName === 'password'
      && message.includes('minLength')
      && operationId !== 'updatePassword'
    ) {
      const minimum = message.match(/minLength is (\d+)/)?.[1];
      if (minimum) {
        return `password must have at least ${minimum} chars.`;
      }
    }
    return `${fieldName} can not be empty`;
  }

  if (fieldName === 'password' && message.includes('minLength')) {
    const minimum = message.match(/minLength is (\d+)/)?.[1];
    if (minimum) {
      return `password must have at least ${minimum} chars.`;
    }
  }

  return message;
};

export default function throwIfOASInputValidationFails(
  spec: OpenAPIV3.Document,
  endPointConfig: Record<string, any>,
  payload: unknown
): boolean {
  const requestBody = endPointConfig?.requestBody;
  if (!requestBody) return true;

  const { content, required } = requestBody;
  if ((payload === undefined || payload === null) && required) {
    throw new ValidationError('Request body is required by OpenAPI schema.');
  }

  if (payload === undefined || payload === null) {
    return true;
  }

  const schema = getSchema(spec, content);
  if (schema) {
    const objectPayload = payload as Record<string, unknown>;
    if (
      typeof objectPayload === 'object'
      && !Array.isArray(objectPayload)
      && schema.properties
    ) {
      const contractInput = Object.fromEntries(
        Object.entries(objectPayload)
          .filter(([name]) => !SERVER_MANAGED_INPUT_PROPERTIES.has(name))
      );
      isPropertiesMatching(contractInput, schema.properties);
      checkRequiredProperties(objectPayload, schema.required || []);
    }

    try {
      validateValueAgainstOpenApiSchema(payload, schema, spec as unknown as Record<string, any>);
    } catch (error) {
      throw new ValidationError(toPublicValidationMessage(
        (error as Error).message,
        payload,
        endPointConfig.operationId
      ));
    }
  }

  return true;
}
