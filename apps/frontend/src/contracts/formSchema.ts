import openApi from './openapi.json';

/**
 * Runtime form engine over the bundled OAS (JUM-766). The app parses the
 * OpenAPI JSON at runtime and forms are built by iterating the schema's
 * properties — nothing about a field is hardcoded, so a spec change (a
 * renamed field, a new maxLength, a new enum option) renders correctly on
 * the next load without touching component code.
 */

export interface FieldDescriptor {
  name: string;
  type: string;
  format?: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
  pattern?: string;
  default?: unknown;
  nullable?: boolean;
  description?: string;
  example?: string;
  xValidation?: Record<string, unknown>;
}

interface RawSchema {
  type?: string;
  format?: string;
  properties?: Record<string, RawSchema>;
  required?: string[];
  $ref?: string;
  allOf?: RawSchema[];
  [facet: string]: unknown;
}

const document = openApi as { components?: { schemas?: Record<string, RawSchema> } };

/** Resolves a local $ref (#/components/schemas/X) to its schema. */
const resolveRef = (schema: RawSchema): RawSchema => {
  if (!schema.$ref) {
    return schema;
  }
  const name = schema.$ref.replace('#/components/schemas/', '');
  const target = document.components?.schemas?.[name];
  if (!target) {
    throw new Error(`formSchema: unresolved $ref ${schema.$ref}`);
  }
  return resolveRef(target);
};

/** Merges allOf parts into a single property/required view. */
const flattenAllOf = (schema: RawSchema): RawSchema => {
  if (!schema.allOf) {
    return schema;
  }
  return schema.allOf.reduce<RawSchema>((acc, part) => {
    const resolved = flattenAllOf(resolveRef(part));
    return {
      ...acc,
      ...resolved,
      properties: { ...acc.properties, ...resolved.properties },
      required: [...(acc.required ?? []), ...(resolved.required ?? [])]
    };
  }, {});
};

export const resolveSchema = (name: string): RawSchema => {
  const schema = document.components?.schemas?.[name];
  if (!schema) {
    throw new Error(`formSchema: schema "${name}" not declared in the bundled OAS`);
  }
  return flattenAllOf(resolveRef(schema));
};

/** Iterates the schema properties in declaration order, one descriptor per field. */
export const fieldDescriptors = (schemaName: string): FieldDescriptor[] => {
  const schema = resolveSchema(schemaName);
  const required = schema.required ?? [];

  return Object.entries(schema.properties ?? {}).map(([name, rawProperty]) => {
    const property = resolveRef(rawProperty);
    return {
      name,
      type: property.type ?? 'string',
      format: property.format as string | undefined,
      required: required.includes(name),
      minLength: property.minLength as number | undefined,
      maxLength: property.maxLength as number | undefined,
      enum: property.enum as string[] | undefined,
      pattern: property.pattern as string | undefined,
      default: property.default,
      nullable: property.nullable as boolean | undefined,
      description: property.description as string | undefined,
      example: property.example !== undefined ? String(property.example) : undefined,
      xValidation: property['x-validation'] as Record<string, unknown> | undefined
    };
  });
};
