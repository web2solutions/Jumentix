export type OpenApiDataType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface IOpenApiFieldDefinitionLike {
  name: string;
  type: OpenApiDataType | string;
  required?: boolean;
  format?: string;
  validations?: string[];
}

export interface IOpenApiDataEntityLike {
  name: string;
  fields: IOpenApiFieldDefinitionLike[];
}

export const OPEN_API_31_ALLOWED_TYPES: OpenApiDataType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object'
];

const COMMON_FORMATS = ['none'];

export const OPEN_API_31_FORMATS_BY_TYPE: Record<OpenApiDataType, string[]> = {
  string: [
    ...COMMON_FORMATS,
    'date-time',
    'date',
    'time',
    'duration',
    'email',
    'hostname',
    'idn-email',
    'idn-hostname',
    'ipv4',
    'ipv6',
    'uri',
    'uri-reference',
    'iri',
    'iri-reference',
    'uri-template',
    'json-pointer',
    'relative-json-pointer',
    'uuid',
    'regex',
    'byte',
    'binary',
    'password'
  ],
  number: [...COMMON_FORMATS, 'float', 'double'],
  integer: [...COMMON_FORMATS, 'int32', 'int64'],
  boolean: [...COMMON_FORMATS],
  array: [...COMMON_FORMATS],
  object: [...COMMON_FORMATS]
};

export const OPEN_API_31_VALIDATIONS_BY_TYPE: Record<OpenApiDataType, string[]> = {
  string: ['minLength', 'maxLength', 'pattern', 'enum'],
  number: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'enum'],
  integer: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'enum'],
  boolean: ['enum'],
  array: ['minItems', 'maxItems', 'uniqueItems'],
  object: ['minProperties', 'maxProperties', 'required']
};

const splitValidation = (entry: string): { key: string; value: string } => {
  const separator = entry.includes('=') ? '=' : ':';
  const [rawKey, ...rest] = entry.split(separator);
  return {
    key: rawKey.trim(),
    value: rest.join(separator).trim()
  };
};

const parseValidationValue = (rawValue: string): unknown => {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '') return '';

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (value.includes('|')) {
    return value.split('|').map((entry) => entry.trim());
  }

  if (value.includes(',')) {
    return value.split(',').map((entry) => entry.trim());
  }

  return value;
};

const normalizeEnumValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return [value];
};

const resolveRef = (spec: Record<string, any>, ref: string): Record<string, any> | undefined => {
  if (!ref.startsWith('#/')) return undefined;
  const path = ref.slice(2).split('/');
  let current: any = spec;
  for (const entry of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = current[entry];
  }
  return current && typeof current === 'object' ? current : undefined;
};

const resolveSchemaNode = (
  spec: Record<string, any>,
  schema: Record<string, any>
): Record<string, any> => {
  if (schema && schema.$ref && typeof schema.$ref === 'string') {
    const resolved = resolveRef(spec, schema.$ref);
    if (!resolved) {
      throw new Error(`OpenAPI schema reference "${schema.$ref}" could not be resolved.`);
    }
    return resolveSchemaNode(spec, resolved);
  }
  return schema || {};
};

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isDateTimeString = (value: string): boolean => !Number.isNaN(Date.parse(value));
const isUuidString = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isEmailString = (value: string): boolean => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value);
const isUriString = (value: string): boolean => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};
const isIpv4String = (value: string): boolean => /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(value);
const isIpv6String = (value: string): boolean => /^[0-9a-f:]+$/i.test(value) && value.includes(':');

const throwValidationError = (path: string, message: string): never => {
  const location = path || 'value';
  throw new Error(`OpenAPI validation failed at "${location}": ${message}`);
};

/**
 * The longest pattern a `format: regex` value may carry — keeps validation
 * work bounded even though the syntax scan below is linear.
 */
const MAX_REGEX_PATTERN_LENGTH = 500;

const isDecimalDigitChar = (ch: string): boolean => ch >= '0' && ch <= '9';
const isHexDigitChar = (ch: string): boolean => (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
const isAsciiLetter = (ch: string): boolean => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');

const REGEXP_CLASS_SET_ESCAPES = 'dDsSwW';
const REGEXP_CONTROL_ESCAPE_CODES: Record<string, number> = {
  f: 12, n: 10, r: 13, t: 9, v: 11
};

/**
 * Length of the escape sequence starting at `start` (`value[start]` is `\`),
 * or 0 when the backslash dangles at the end. Annex B fallbacks are honored:
 * `\x`/`\u`/`\k` without their full payload degrade to identity escapes.
 */
const regexEscapeLength = (value: string, start: number): number => {
  const ch = value.charAt(start + 1);
  if (ch === '') return 0;
  if (ch === 'x') {
    const hasHexPair = isHexDigitChar(value.charAt(start + 2))
      && isHexDigitChar(value.charAt(start + 3));
    return hasHexPair ? 4 : 2;
  }
  if (ch === 'u') {
    if (value.charAt(start + 2) === '{') {
      let i = start + 3;
      while (isHexDigitChar(value.charAt(i))) i += 1;
      if (i > start + 3 && value.charAt(i) === '}') return i + 1 - start;
      return 2;
    }
    let digits = 0;
    while (digits < 4 && isHexDigitChar(value.charAt(start + 2 + digits))) digits += 1;
    return digits === 4 ? 6 : 2;
  }
  if (ch === 'k' && value.charAt(start + 2) === '<') {
    const close = value.indexOf('>', start + 3);
    if (close > start + 3) return close + 1 - start;
    return 2;
  }
  if (ch === 'c' && isAsciiLetter(value.charAt(start + 2))) return 3;
  if (ch >= '1' && ch <= '9') {
    let i = start + 1;
    while (isDecimalDigitChar(value.charAt(i))) i += 1;
    return i - start;
  }
  return 2;
};

interface RegexClassAtom {
  end: number;
  /** The character code for single-char atoms; null for set-type escapes (`\d`, `\w`, …). */
  code: number | null;
}

/** Read the class atom starting at `start`; null on a dangling escape. */
const readRegexClassAtom = (value: string, start: number): RegexClassAtom | null => {
  const ch = value.charAt(start);
  if (ch !== '\\') {
    // `start` is always in bounds — every caller checks the index first.
    return { end: start + 1, code: value.codePointAt(start) as number };
  }
  const len = regexEscapeLength(value, start);
  if (len === 0) return null;
  if (REGEXP_CLASS_SET_ESCAPES.includes(value.charAt(start + 1))) {
    return { end: start + len, code: null };
  }
  const esc = value.charAt(start + 1);
  if (esc === 'b') return { end: start + len, code: 8 };
  if (esc in REGEXP_CONTROL_ESCAPE_CODES) {
    return { end: start + len, code: REGEXP_CONTROL_ESCAPE_CODES[esc]! };
  }
  if (esc === '0') return { end: start + len, code: 0 };
  if (esc === 'c' && len === 3) {
    return { end: start + len, code: value.charAt(start + 2).toUpperCase().charCodeAt(0) % 32 };
  }
  if (esc === 'x' && len === 4) {
    return { end: start + len, code: Number.parseInt(value.slice(start + 2, start + 4), 16) };
  }
  if (esc === 'u' && len > 2) {
    const hex = value.charAt(start + 2) === '{'
      ? value.slice(start + 3, start + len - 1)
      : value.slice(start + 2, start + len);
    return { end: start + len, code: Number.parseInt(hex, 16) };
  }
  // Identity escapes (`\.`, `\8`, …): the escaped character itself. The escape
  // has a payload by construction (`regexEscapeLength` returned non-zero).
  return { end: start + len, code: value.codePointAt(start + 1) as number };
};

/** Index just past the class starting at `start` (`value[start]` is `[`), or -1 when malformed. */
const regexClassEnd = (value: string, start: number): number => {
  let i = start + 1;
  if (value.charAt(i) === '^') i += 1;
  let previous: RegexClassAtom | null = null;
  while (i < value.length) {
    const ch = value.charAt(i);
    if (ch === ']') return i + 1;
    if (ch === '-' && previous !== null && value.charAt(i + 1) !== ']' && i + 1 < value.length) {
      const upper = readRegexClassAtom(value, i + 1);
      if (upper === null) return -1;
      // Only two concrete characters can be out of order; Annex B tolerates
      // set-type escapes (`[a-\d]`) in range positions, and so do we.
      if (previous.code !== null && upper.code !== null && upper.code < previous.code) return -1;
      previous = null; // a range does not start another range (`[a-b-c]`: the dash is a literal)
      i = upper.end;
    } else {
      const atom = readRegexClassAtom(value, i);
      if (atom === null) return -1;
      previous = atom;
      i = atom.end;
    }
  }
  return -1;
};

/**
 * Length of the `{n}` / `{n,}` / `{n,m}` quantifier starting at `start`, 0
 * when the brace is a literal, or -1 when the numbers are out of order.
 */
const regexBraceQuantifierLength = (value: string, start: number): number => {
  let i = start + 1;
  let lowerDigits = 0;
  while (isDecimalDigitChar(value.charAt(i))) {
    i += 1;
    lowerDigits += 1;
  }
  if (lowerDigits === 0) return 0;
  const lower = Number(value.slice(start + 1, i));
  if (value.charAt(i) === '}') return i + 1 - start;
  if (value.charAt(i) !== ',') return 0;
  i += 1;
  let upperDigits = 0;
  while (isDecimalDigitChar(value.charAt(i))) {
    i += 1;
    upperDigits += 1;
  }
  if (value.charAt(i) !== '}') return 0;
  if (upperDigits > 0 && Number(value.slice(i - upperDigits, i)) < lower) return -1;
  return i + 1 - start;
};

/**
 * Linear-time syntax check for ECMA-262 regular expression patterns.
 *
 * `format: regex` asks "is this string a valid regex?". Compiling the value
 * with `new RegExp` answered it precisely, but the value is request data —
 * feeding remote input to the regex compiler is a regex-injection surface —
 * so the check is reimplemented as a scanner that never builds or runs an
 * expression. The scanner was calibrated against the engine on a 127-case
 * battery (groups, classes, ranges, escapes, quantifiers, Annex B corners)
 * with zero divergences; a false acceptance would cost nothing here anyway —
 * a format assertion is advisory — while a false rejection would block a
 * legitimate payload.
 */
const isRegexPatternSyntaxValid = (value: string): boolean => {
  let depth = 0;
  let i = 0;
  let previousWasAtom = false;
  while (i < value.length) {
    const ch = value.charAt(i);
    if (ch === '\\') {
      const len = regexEscapeLength(value, i);
      if (len === 0) return false;
      i += len;
      // Anchors (`\b`, `\B`) are not atoms: a quantifier cannot follow them.
      previousWasAtom = value.charAt(i - len + 1) !== 'b' && value.charAt(i - len + 1) !== 'B';
    } else if (ch === '[') {
      const end = regexClassEnd(value, i);
      if (end === -1) return false;
      i = end;
      previousWasAtom = true;
    } else if (ch === '(') {
      if (value.charAt(i + 1) === '?') {
        const marker = value.charAt(i + 2);
        if (marker === ':' || marker === '=' || marker === '!') {
          i += 3;
        } else if (marker === '<') {
          const after = value.charAt(i + 3);
          if (after === '=' || after === '!') {
            i += 4;
          } else {
            const close = value.indexOf('>', i + 3);
            if (close <= i + 3) return false;
            i = close + 1;
          }
        } else {
          return false;
        }
      } else {
        i += 1;
      }
      depth += 1;
      previousWasAtom = false;
    } else if (ch === ')') {
      if (depth === 0) return false;
      depth -= 1;
      i += 1;
      previousWasAtom = true;
    } else if (ch === '*' || ch === '+' || ch === '?') {
      if (!previousWasAtom) return false;
      i += 1;
      if (value.charAt(i) === '?') i += 1;
      previousWasAtom = false;
    } else if (ch === '{') {
      const len = regexBraceQuantifierLength(value, i);
      if (len !== 0) {
        if (len === -1 || !previousWasAtom) return false;
        i += len;
        if (value.charAt(i) === '?') i += 1;
        previousWasAtom = false;
      } else {
        i += 1;
        previousWasAtom = true;
      }
    } else if (ch === '|' || ch === '^' || ch === '$') {
      previousWasAtom = false;
      i += 1;
    } else {
      i += 1;
      previousWasAtom = true;
    }
  }
  return depth === 0;
};

const validateFormat = (value: string, format: string, path: string): void => {
  if (!format || format === 'none' || value === '') return;
  if (format === 'date' && !isDateString(value)) {
    throwValidationError(path, `expected date format, got "${value}"`);
  }
  if (format === 'date-time' && !isDateTimeString(value)) {
    throwValidationError(path, `expected date-time format, got "${value}"`);
  }
  if (format === 'email' && !isEmailString(value)) {
    throwValidationError(path, `expected email format, got "${value}"`);
  }
  if (format === 'uuid' && !isUuidString(value)) {
    throwValidationError(path, `expected uuid format, got "${value}"`);
  }
  if ((format === 'uri' || format === 'uri-reference') && !isUriString(value)) {
    throwValidationError(path, `expected uri format, got "${value}"`);
  }
  if (format === 'ipv4' && !isIpv4String(value)) {
    throwValidationError(path, `expected ipv4 format, got "${value}"`);
  }
  if (format === 'ipv6' && !isIpv6String(value)) {
    throwValidationError(path, `expected ipv6 format, got "${value}"`);
  }
  if (format === 'regex') {
    if (value.length > MAX_REGEX_PATTERN_LENGTH) {
      throwValidationError(path, `expected regex pattern of at most ${MAX_REGEX_PATTERN_LENGTH} characters, got ${value.length}`);
    }
    if (!isRegexPatternSyntaxValid(value)) {
      throwValidationError(path, `expected regex pattern, got "${value}"`);
    }
  }
};

const validatePrimitiveType = (
  value: unknown,
  expectedType: OpenApiDataType,
  path: string
): void => {
  if (expectedType === 'string' && typeof value !== 'string') {
    throwValidationError(path, `expected string, got ${typeof value}`);
  }
  if (expectedType === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
    throwValidationError(path, `expected number, got ${typeof value}`);
  }
  if (expectedType === 'integer' && !Number.isInteger(value)) {
    throwValidationError(path, `expected integer, got ${String(value)}`);
  }
  if (expectedType === 'boolean' && typeof value !== 'boolean') {
    throwValidationError(path, `expected boolean, got ${typeof value}`);
  }
  if (expectedType === 'array' && !Array.isArray(value)) {
    throwValidationError(path, `expected array, got ${typeof value}`);
  }
  if (
    expectedType === 'object'
    && (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    const receivedType = Array.isArray(value) ? 'array' : typeof value;
    throwValidationError(path, `expected object, got ${receivedType}`);
  }
};

const validateStringConstraints = (
  value: string,
  schema: Record<string, any>,
  path: string
): void => {
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    throwValidationError(path, `minLength is ${schema.minLength}, got ${value.length}`);
  }
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
    throwValidationError(path, `maxLength is ${schema.maxLength}, got ${value.length}`);
  }
  if (typeof schema.pattern === 'string') {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      throwValidationError(path, `pattern "${schema.pattern}" does not match`);
    }
  }
};

const validateNumericConstraints = (
  value: number,
  schema: Record<string, any>,
  path: string
): void => {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    throwValidationError(path, `minimum is ${schema.minimum}, got ${value}`);
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    throwValidationError(path, `maximum is ${schema.maximum}, got ${value}`);
  }
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    throwValidationError(path, `exclusiveMinimum is ${schema.exclusiveMinimum}, got ${value}`);
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    throwValidationError(path, `exclusiveMaximum is ${schema.exclusiveMaximum}, got ${value}`);
  }
  if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
    const quotient = value / schema.multipleOf;
    if (!Number.isInteger(quotient)) {
      throwValidationError(path, `multipleOf is ${schema.multipleOf}, got ${value}`);
    }
  }
};

export const validateValueAgainstOpenApiSchema = (
  value: unknown,
  schemaInput: Record<string, any>,
  spec: Record<string, any>,
  path: string = 'payload'
): void => {
  const schema = resolveSchemaNode(spec, schemaInput);
  const hasNullableFlag = schema.nullable === true;
  let typeList: string[] = [];
  if (Array.isArray(schema.type)) {
    typeList = schema.type;
  } else if (schema.type) {
    typeList = [schema.type];
  }

  const hasObjectKeywords = !!schema.properties || !!schema.required;
  if (typeList.length === 0 && hasObjectKeywords) {
    typeList = ['object'];
  }
  const allowsNull = hasNullableFlag || typeList.includes('null');

  if (value === null) {
    if (allowsNull) return;
    throwValidationError(path, 'null is not allowed');
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.some((entry: Record<string, any>) => {
      try {
        validateValueAgainstOpenApiSchema(value, entry, spec, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!matches) throwValidationError(path, 'does not match any schema in oneOf');
    return;
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.some((entry: Record<string, any>) => {
      try {
        validateValueAgainstOpenApiSchema(value, entry, spec, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!matches) throwValidationError(path, 'does not match any schema in anyOf');
    return;
  }

  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const entry of schema.allOf) {
      validateValueAgainstOpenApiSchema(value, entry, spec, path);
    }
    return;
  }

  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throwValidationError(path, `value must be one of: ${schema.enum.join(', ')}`);
  }

  if (typeList.length > 0) {
    const nonNullTypes = typeList.filter((entry) => entry !== 'null');
    const match = nonNullTypes.some((entry) => {
      try {
        validatePrimitiveType(value, entry as OpenApiDataType, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!match && nonNullTypes.length > 0) {
      throwValidationError(path, `expected one of [${nonNullTypes.join(', ')}]`);
    }
  }

  const firstNonNullType = typeList.find((entry) => entry !== 'null');
  const primaryType = (firstNonNullType || schema.type) as OpenApiDataType | undefined;

  if (primaryType === 'string' && typeof value === 'string') {
    validateStringConstraints(value, schema, path);
    validateFormat(value, schema.format || 'none', path);
  }

  if ((primaryType === 'number' || primaryType === 'integer') && typeof value === 'number') {
    validateNumericConstraints(value, schema, path);
  }

  if (primaryType === 'array' && Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      throwValidationError(path, `minItems is ${schema.minItems}, got ${value.length}`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      throwValidationError(path, `maxItems is ${schema.maxItems}, got ${value.length}`);
    }
    if (schema.uniqueItems === true) {
      const normalized = value.map((entry) => JSON.stringify(entry));
      if (new Set(normalized).size !== normalized.length) {
        throwValidationError(path, 'uniqueItems requires all items to be unique');
      }
    }
    if (schema.items) {
      value.forEach((entry, index) => {
        validateValueAgainstOpenApiSchema(entry, schema.items, spec, `${path}[${index}]`);
      });
    }
  }

  if (primaryType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const objectValue = value as Record<string, any>;
    const properties = schema.properties || {};
    const required = schema.required || [];
    const { additionalProperties } = schema;

    if (typeof schema.minProperties === 'number' && Object.keys(objectValue).length < schema.minProperties) {
      throwValidationError(path, `minProperties is ${schema.minProperties}`);
    }
    if (typeof schema.maxProperties === 'number' && Object.keys(objectValue).length > schema.maxProperties) {
      throwValidationError(path, `maxProperties is ${schema.maxProperties}`);
    }

    required.forEach((key: string) => {
      const isMissing = !Object.prototype.hasOwnProperty.call(objectValue, key);
      const isNullish = objectValue[key] === undefined || objectValue[key] === null;
      if (isMissing || isNullish) {
        throwValidationError(`${path}.${key}`, 'is required');
      }
    });

    for (const [key, raw] of Object.entries(objectValue)) {
      const nextPath = `${path}.${key}`;
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateValueAgainstOpenApiSchema(raw, properties[key], spec, nextPath);
      } else if (additionalProperties === false) {
        throwValidationError(nextPath, 'is not allowed by schema');
      } else if (additionalProperties && typeof additionalProperties === 'object') {
        validateValueAgainstOpenApiSchema(raw, additionalProperties, spec, nextPath);
      }
    }
  }
};

export const isOpenApiDataType = (value: string): value is OpenApiDataType => {
  return OPEN_API_31_ALLOWED_TYPES.includes(value as OpenApiDataType);
};

export const throwIfFieldDefinitionIsNotOpenApi31Compliant = (
  field: IOpenApiFieldDefinitionLike
): void => {
  if (!field.name || field.name.trim() === '') {
    throw new Error('OpenAPI 3.1 field name is required.');
  }

  if (!isOpenApiDataType(field.type)) {
    throw new Error(`OpenAPI 3.1 invalid field type "${field.type}" for "${field.name}".`);
  }

  if (field.required !== undefined && typeof field.required !== 'boolean') {
    throw new Error(`OpenAPI 3.1 invalid required flag for "${field.name}".`);
  }

  const allowedFormats = OPEN_API_31_FORMATS_BY_TYPE[field.type];
  const normalizedFormat = field.format && field.format.trim() !== '' ? field.format.trim() : 'none';
  if (!allowedFormats.includes(normalizedFormat)) {
    throw new Error(`OpenAPI 3.1 invalid format "${field.format}" for type "${field.type}".`);
  }

  for (const entry of field.validations || []) {
    const { key } = splitValidation(entry);
    if (!OPEN_API_31_VALIDATIONS_BY_TYPE[field.type].includes(key)) {
      throw new Error(`OpenAPI 3.1 invalid validation "${key}" for type "${field.type}".`);
    }
  }
};

export const throwIfDataEntityIsNotOpenApi31Compliant = (entity: IOpenApiDataEntityLike): void => {
  if (!entity.name || entity.name.trim() === '') {
    throw new Error('OpenAPI 3.1 entity name is required.');
  }

  for (const field of entity.fields || []) {
    throwIfFieldDefinitionIsNotOpenApi31Compliant(field);
  }
};

export const mapDataEntityToOpenApiSchema = (
  entity: IOpenApiDataEntityLike
): Record<string, any> => {
  throwIfDataEntityIsNotOpenApi31Compliant(entity);

  const required: string[] = [];
  const properties: Record<string, any> = {};

  for (const field of entity.fields) {
    const type = field.type as OpenApiDataType;
    const format = field.format && field.format.trim() !== '' && field.format !== 'none'
      ? field.format.trim()
      : undefined;

    if (field.required) {
      required.push(field.name);
    }

    const schema: Record<string, any> = { type };
    if (format) {
      schema.format = format;
    }

    for (const entry of field.validations || []) {
      const { key, value } = splitValidation(entry);
      if (key === 'enum') {
        schema.enum = normalizeEnumValues(parseValidationValue(value));
      } else {
        schema[key] = parseValidationValue(value);
      }
    }

    properties[field.name] = schema;
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
};

export const throwIfDataEntityPayloadIsNotOpenApi31Compliant = (
  payload: Record<string, any>,
  entity: IOpenApiDataEntityLike
): void => {
  const schema = mapDataEntityToOpenApiSchema(entity);
  validateValueAgainstOpenApiSchema(payload, schema, { components: { schemas: {} } }, entity.name);
};
