/**
 * propertyKeys — the one place that decides whether a field name is a bare
 * property key (JUM-731).
 *
 * The codegen already had this rule: `toPropertyKey` emits a bare key when the
 * name is a valid identifier and a quoted one otherwise. The model validation
 * had no equivalent, so a field named `my field name!` passed `Validate Model`
 * with `No issues found.` and travelled into three OAS schemas, the code
 * preview and the boilerplate bundle as `"my field name!"?: string;`.
 *
 * Both sides now read the rule from here, so the warning the designer shows and
 * the quoting the generator performs cannot disagree.
 *
 * The rule is deliberately a WARNING, not an error, and the designer does not
 * refuse the name:
 *
 * - nothing produced is invalid. A JSON Schema property may be any string, and
 *   a quoted member name is valid TypeScript. This is deliverability — the
 *   property is reachable only by index — not a spec violation;
 * - refusing would remove a legitimate case. Field names that mirror an
 *   external contract (`content-type`, a vendor's `x-request-id`) are real, and
 *   the generator already handles them correctly by quoting.
 */

/** The identifier rule the code generator uses to decide bare vs quoted. */
const BARE_PROPERTY_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Is this name emitted as a bare property key?
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isBarePropertyKey(name) {
  return BARE_PROPERTY_KEY.test(String(name ?? ''));
}

/**
 * Why a name will be quoted, phrased for the person who typed it.
 *
 * @param {string} name
 * @returns {string}
 */
export function describeQuotedPropertyKey(name) {
  return `will be emitted as "${name}" in the OpenAPI schema and the generated code, `
    + 'reachable only by index. A name starting with a letter, `_` or `$` and '
    + 'continuing with letters, digits, `_` or `$` is emitted bare.';
}
