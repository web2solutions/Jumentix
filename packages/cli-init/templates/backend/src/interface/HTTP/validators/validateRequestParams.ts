import { ValidationError } from '@src/infra/exceptions';
import { validateValueAgainstOpenApiSchema } from '@src/shared/openapi/OpenApi31DataEntity';

const coerceQueryValue = (value: unknown, schema: Record<string, any>): unknown => {
  if (typeof value !== 'string') return value;
  const type = Array.isArray(schema?.type) ? schema.type[0] : schema?.type;
  if (type === 'integer' || type === 'number') {
    const trimmed = value.trim();
    if (trimmed === '') return value;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? value : parsed;
  }
  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
};

/**
 * Validate request parameters
 * @param endPointConfig
 * @param requestParams
 */
export default function validateRequestParams(
  endPointConfig: Record<string, any>,
  requestParams: Record<string, any>,
  queryString: Record<string, any> = {},
  headers: Record<string, any> = {}
): boolean {
  const { parameters } = endPointConfig;
  if (!parameters) return true;
  for (const parameter of parameters) {
    const {
      name,
      required,
      schema = {},
      in: location = 'path'
    } = parameter;
    let source = requestParams;
    if (location === 'query') {
      source = queryString;
    } else if (location === 'header') {
      source = headers;
    }
    // Query strings arrive as text; coerce to the declared primitive before
    // validating so `page=2` satisfies `type: integer` (JUM-777). Values that
    // do not parse stay strings and fail the type check with a clear message.
    const value = location === 'query' ? coerceQueryValue(source?.[name], schema) : source?.[name];

    if (required) {
      if (value === undefined || value === null || value === '') {
        throw new ValidationError(`The parameter ${name} is required in ${location}.`);
      }
    }

    if (value !== undefined && value !== null) {
      if (typeof value === 'string' && value.length === 0) {
        throw new ValidationError(`The parameter ${name} can not be empty.`);
      }
      if (typeof value === 'string' && value.toLowerCase() === 'null') {
        throw new ValidationError(`The parameter ${name} can not be null.`);
      }

      try {
        validateValueAgainstOpenApiSchema(
          value,
          schema,
          { components: { schemas: {} } },
          `params.${name}`
        );
      } catch (error) {
        throw new ValidationError((error as Error).message);
      }
    }
  }
  return true;
}
