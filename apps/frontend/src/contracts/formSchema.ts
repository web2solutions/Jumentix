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
  /** `x-relation` (JUM-787): FK to another entity; list op comes from `<Entity>ArrayOf`. */
  relation?: {
    field: string;
    entity: string;
    match: string;
    display: string;
    kind: 'belongsTo' | 'hasMany';
  };
  /** JSON Schema `title`: the label fallback before humanizing the property name (JUM-780). */
  title?: string;
  /** `x-label` (JUM-780): localized labels keyed by locale (`en`, `pt-BR`). */
  xLabel?: Record<string, string>;
}

interface RawSchema {
  type?: string;
  format?: string;
  properties?: Record<string, RawSchema>;
  required?: string[];
  $ref?: string;
  items?: RawSchema;
  allOf?: RawSchema[];
  [facet: string]: unknown;
}

const document = openApi as {
  components?: { schemas?: Record<string, RawSchema> };
  paths?: Record<string, Record<string, RawSchema & {
    operationId?: string;
    responses?: Record<string, unknown>;
  }>>;
};

export interface EntityRelation {
  field: string;
  entity: string;
  match: string;
  display: string;
  kind: 'belongsTo' | 'hasMany';
}

/** Schema-level `x-primary-key`, default `id`. */
export const entityPrimaryKey = (entity: string): string => {
  const schema = document.components?.schemas?.[entity];
  const key = schema?.['x-primary-key'];
  return typeof key === 'string' && key.length > 0 ? key : 'id';
};

const asRelation = (property: RawSchema, name: string): EntityRelation | undefined => {
  const raw = property['x-relation'] as Partial<EntityRelation> | undefined;
  if (!raw || typeof raw !== 'object' || !raw.entity) return undefined;
  return {
    field: raw.field ?? name,
    entity: raw.entity,
    match: raw.match ?? entityPrimaryKey(raw.entity),
    display: raw.display ?? 'name',
    kind: raw.kind === 'hasMany' ? 'hasMany' : 'belongsTo'
  };
};

const responseSchemaName = (operation: RawSchema): string | undefined => {
  const ok = (operation.responses as Record<string, any> | undefined)?.['200'];
  const ref = ok?.content?.['application/json']?.schema?.$ref as string | undefined;
  return ref?.replace('#/components/schemas/', '');
};

/** List operation whose 200 schema is `<Entity>ArrayOf`. */
export const listOperationForEntity = (entity: string): string | undefined => {
  const expected = `${entity}ArrayOf`;
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId && responseSchemaName(operation) === expected) {
        return operation.operationId;
      }
    }
  }
  return undefined;
};

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

  return Object.entries(schema.properties ?? {})
    // `x-hide: true` (JUM-769): the property stays in the contract (defaults
    // apply server-side) but never renders in OAS-driven forms.
    .filter(([, rawProperty]) => resolveRef(rawProperty)['x-hide'] !== true)
    .map(([name, rawProperty]) => {
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
        xValidation: property['x-validation'] as Record<string, unknown> | undefined,
        relation: asRelation(property, name),
        title: property.title as string | undefined,
        xLabel: property['x-label'] as Record<string, string> | undefined
      };
    });
};

/**
 * Descriptors for the items of an array-of-objects field (JUM-772): resolves
 * `properties[field].items.$ref` to the item schema and iterates it. Returns
 * undefined for scalar arrays or fields without a $ref — those are not
 * object editors.
 */
export const arrayItemDescriptors = (
  schemaName: string,
  fieldName: string
): FieldDescriptor[] | undefined => {
  const schema = resolveSchema(schemaName);
  const property = schema.properties?.[fieldName];
  const itemRef = property?.items?.$ref;
  if (!itemRef) return undefined;
  const itemSchema = itemRef.replace('#/components/schemas/', '');
  return fieldDescriptors(itemSchema).filter((d) => d.name !== 'id');
};
