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

/** Progressive mask for a document's data per OAS rule (CPF/SSN masked, others free-form). */
export const maskDocumentData = (type: string, countryIssue: string, raw: string): string => {
  if (type === 'CPF') return maskCpf(raw);
  if (type === 'SSN') return maskSsn(raw);
  return raw;
};

/** Input cap derived from the OAS mask: typing beyond it is blocked, not invalidated. */
export const documentMaskCap = (type: string, countryIssue: string): number | undefined => {
  const rule = documentRuleFor(type, countryIssue);
  return rule?.mask ? rule.mask.length : undefined;
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
