const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_PATTERN = /^[0-9a-f]{32}$/i;

function fromCompactUuid(value: string): string {
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20)
  ].join('-');
}

function normalizeUuid(value: string): string {
  const candidate = value.trim().toLowerCase();
  const canonical = COMPACT_UUID_PATTERN.test(candidate)
    ? fromCompactUuid(candidate)
    : candidate;

  if (!UUID_PATTERN.test(canonical)) {
    throw new Error('Invalid UUID');
  }

  return canonical;
}

export function createUuid(): string {
  const runtimeCrypto = globalThis.crypto;

  if (typeof runtimeCrypto?.randomUUID === 'function') {
    return runtimeCrypto.randomUUID();
  }

  if (typeof runtimeCrypto?.getRandomValues !== 'function') {
    throw new Error('Secure UUID generation is unavailable');
  }

  const bytes = runtimeCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] % 16) + 64;
  bytes[8] = (bytes[8] % 64) + 128;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return fromCompactUuid(hex);
}

export class UUID {
  private readonly uuid: string;

  private constructor(id?: string) {
    try {
      if (id) {
        this.uuid = normalizeUuid(id);
      } else {
        this.uuid = createUuid();
      }
    } catch (error) {
      throw new Error('Invalid UUID');
    }
  }

  public static create(): UUID {
    return new this();
  }

  public static parse(uuid: string): UUID {
    return new this(uuid);
  }

  public toString(): string {
    return this.uuid;
  }
}
