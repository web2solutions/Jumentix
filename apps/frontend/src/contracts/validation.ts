import openApi from './openapi.json';

/**
 * Document/phone masks and validations driven by the `x-validation` blocks
 * declared in the OAS (JUM-765) — the contract is the single source of these
 * rules; this module only executes them (requirement 136).
 */

interface ValidationRule {
  when: Record<string, string>;
  pattern?: string;
  mask?: string;
  checksum?: string;
  example?: string;
}

const documentRules = (): ValidationRule[] => {
  const data = (openApi as any)?.components?.schemas?.Document?.properties?.data;
  return (data?.['x-validation']?.rules ?? []) as ValidationRule[];
};

const phoneRules = (): ValidationRule[] => {
  const number = (openApi as any)?.components?.schemas?.Phone?.properties?.number;
  return (number?.['x-validation']?.rules ?? []) as ValidationRule[];
};

export const documentRuleFor = (type: string, countryIssue: string): ValidationRule | undefined => (
  documentRules().find((rule) => (
    (!rule.when.type || rule.when.type === type)
    && (!rule.when.countryIssue || rule.when.countryIssue === countryIssue)
  ))
);

export const phoneRuleFor = (countryCode: string): ValidationRule | undefined => (
  phoneRules().find((rule) => rule.when.countryCode === countryCode)
);

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const applyMask = (digits: string, mask: string): string => {
  let result = '';
  let digitIndex = 0;
  for (const char of mask) {
    if (digitIndex >= digits.length) break;
    if (char === '0') {
      result += digits[digitIndex];
      digitIndex += 1;
    } else {
      result += char;
    }
  }
  return result;
};

/** Progressive CPF mask: digits are grouped 000.000.000-00 as the user types. */
export const maskCpf = (raw: string): string => (
  applyMask(digitsOnly(raw).slice(0, 11), '000.000.000-00')
);

/** Progressive SSN mask: 000-00-0000. */
export const maskSsn = (raw: string): string => (
  applyMask(digitsOnly(raw).slice(0, 9), '000-00-0000')
);

/** Progressive phone mask by country rule declared in the OAS. */
export const maskPhone = (countryCode: string, raw: string): string => {
  const rule = phoneRuleFor(countryCode);
  const digits = digitsOnly(raw).slice(0, 9);
  if (!rule?.mask) {
    return digits;
  }
  return applyMask(digits, rule.mask);
};

/**
 * Extracts the declared char class from anchored class patterns
 * (`^[A-Za-z0-9]{5,20}$` → `A-Za-z0-9`). Returns undefined for any other
 * shape — digit-pattern rules (CPF/SSN/phone) are handled by masks instead.
 */
export const patternAlphabet = (pattern: string | undefined): string | undefined => (
  pattern?.match(/^\^\[([^\]]+)\]\{\d+(?:,\d*)?\}\$$/)?.[1]
);

/**
 * Extracts the upper bound of the quantifier in an anchored class pattern
 * (`{5,20}` → 20, `{11}` → 11, `{5,}` → undefined = unbounded).
 */
export const patternCap = (pattern: string | undefined): number | undefined => {
  const quantifier = pattern?.match(/^\^\[[^\]]+\]\{(\d+)(,(\d*))?\}\$$/);
  if (!quantifier) return undefined;
  if (quantifier[2] !== undefined) {
    // `{m,}` is unbounded; `{m,n}` caps at n.
    return quantifier[3] ? Number(quantifier[3]) : undefined;
  }
  return Number(quantifier[1]);
};

/**
 * Input filter for a document's data (JUM-769): CPF/SSN keep their masks;
 * pattern-only rules (passport, RG) strip characters outside the declared
 * alphabet and hard-cap at the pattern's upper bound, so over-typing is
 * blocked at the input instead of failing at save time. Types with no
 * declared rule stay free-form per OAS.
 */
export const filterDocumentData = (type: string, countryIssue: string, raw: string): string => {
  if (type === 'CPF') return maskCpf(raw);
  if (type === 'SSN') return maskSsn(raw);
  const rule = documentRuleFor(type, countryIssue);
  const alphabet = patternAlphabet(rule?.pattern);
  if (!alphabet) return raw;
  const filtered = raw.replace(new RegExp(`[^${alphabet}]`, 'g'), '');
  const cap = patternCap(rule?.pattern);
  return cap === undefined ? filtered : filtered.slice(0, cap);
};

/** Input cap for a document's data: OAS mask length, or the pattern's upper bound. */
export const documentInputCap = (type: string, countryIssue: string): number | undefined => {
  const rule = documentRuleFor(type, countryIssue);
  if (!rule) return undefined;
  return rule.mask ? rule.mask.length : patternCap(rule.pattern);
};

/** Input cap for a phone number from the OAS mask of the country rule. */
export const phoneMaskCap = (countryCode: string): number | undefined => {
  const rule = phoneRuleFor(countryCode);
  return rule?.mask ? rule.mask.length : undefined;
};

/** Modulo-11 checksum for the two CPF verification digits. */
export const isValidCpf = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  const numbers = digits.split('').map(Number);
  const checksum = (count: number): number => {
    const sum = numbers.slice(0, count - 1).reduce((acc, n, i) => acc + n * (count - i), 0);
    const digit = (sum * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  return checksum(10) === numbers[9] && checksum(11) === numbers[10];
};

const matches = (pattern: string | undefined, value: string): boolean => (
  pattern ? new RegExp(pattern).test(value) : true
);

/**
 * Full document validation: OAS pattern for the type+country, plus the CPF
 * checksum when the rule declares one.
 */
export const validateDocumentData = (
  type: string,
  countryIssue: string,
  value: string
): string | null => {
  if (!value.trim()) {
    return 'Número do documento é obrigatório.';
  }
  const rule = documentRuleFor(type, countryIssue);
  if (!rule) {
    return null; // no declared rule for this type+country — free-form per OAS
  }
  if (!matches(rule.pattern, value)) {
    return `Formato inválido para ${type}${rule.example ? ` — exemplo: ${rule.example}` : ''}.`;
  }
  if (rule.checksum === 'cpf-mod11' && !isValidCpf(value)) {
    return 'CPF inválido — dígitos verificadores não conferem.';
  }
  return null;
};

/** Phone validation against the OAS rule for the country code. */
export const validatePhone = (
  countryCode: string,
  localCode: string,
  value: string
): string | null => {
  if (!value.trim()) {
    return 'Número de telefone é obrigatório.';
  }
  const rule = phoneRuleFor(countryCode);
  if (rule?.pattern && !matches(rule.pattern, value)) {
    return `Telefone inválido para ${countryCode} — exemplo: ${rule.example ?? '0000-0000'}.`;
  }
  return null;
};
