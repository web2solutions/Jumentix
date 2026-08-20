const { randomFillSync, randomUUID } = require('crypto');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_BY_BYTE = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, '0'));

function getRandomBytes() {
  const bytes = new Uint8Array(16);
  randomFillSync(bytes);
  return bytes;
}

function stringify(bytes) {
  const parts = Array.from(bytes, (byte) => HEX_BY_BYTE[byte]);

  return [
    parts.slice(0, 4).join(''),
    parts.slice(4, 6).join(''),
    parts.slice(6, 8).join(''),
    parts.slice(8, 10).join(''),
    parts.slice(10, 16).join('')
  ].join('-');
}

function makeUuid(version) {
  if (version === 4 && typeof randomUUID === 'function') {
    return randomUUID();
  }

  const bytes = getRandomBytes();
  bytes[6] = version * 16 + (bytes[6] % 16);
  bytes[8] = 128 + (bytes[8] % 64);

  return stringify(bytes);
}

function v1() {
  return makeUuid(1);
}

function v4() {
  return makeUuid(4);
}

function validate(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function version(value) {
  if (!validate(value)) {
    throw new TypeError('Invalid UUID');
  }

  return Number(value[14]);
}

function parse(value) {
  if (!validate(value)) {
    throw new TypeError('Invalid UUID');
  }

  const compact = value.replace(/-/g, '');
  const bytes = new Uint8Array(16);

  for (let index = 0; index < compact.length; index += 2) {
    bytes[index / 2] = Number.parseInt(compact.slice(index, index + 2), 16);
  }

  return bytes;
}

module.exports = {
  NIL: '00000000-0000-0000-0000-000000000000',
  parse,
  stringify,
  v1,
  v4,
  validate,
  version
};
