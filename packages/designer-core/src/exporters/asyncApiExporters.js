/**
 * asyncApiExporters — AsyncAPI 3.0 and gRPC proto export builders of the
 * Service Management designer (JUM-475), targeting the canonical
 * `spec/asyncapi/` conventions:
 *
 * - `spec/asyncapi/<version>.websocket.yml` and
 *   `spec/asyncapi/<version>.grpc.yml` declare `asyncapi: 3.0.0`, so the
 *   export emits ONE AsyncAPI 3.0 document per transport (never a single
 *   combined document, never the 2.x publish/subscribe shape — under 3.0,
 *   channels hold `messages` and the top-level `operations` map carries
 *   `action: send|receive` plus channel/message `$ref`s).
 * - `spec/asyncapi/async-api.proto` is the gRPC contract: proto3, package
 *   `realtime`, service `AsyncApiGateway`, envelope messages
 *   `AsyncApiRequest`/`AsyncApiResponse`. The proto export reproduces that
 *   envelope and derives one rpc/message pair per designer message contract.
 *
 * Payload discipline mirrors the OAS `$ref` rule (JUM-474): message payloads
 * live once under `components.schemas` and messages reference them — identical
 * payloads share a single schema entry instead of being inlined per message.
 *
 * Like `designerExporters.js`, every builder is a pure function over the
 * state object — no DOM, no `Blob` — so the module imports and runs under
 * Bun/Node for the round-trip suites; the download glue stays in
 * `script.js`. YAML text is produced by the local `toYaml` emitter (the
 * designer SPA has no bundler, so no `yaml` package import is possible in
 * the browser); the test suite round-trips every emitted document through
 * the real `yaml` parser.
 */

import { toPathToken, toSchemaName } from '../model/modelQueries.js';

/** AsyncAPI specification version declared by the canonical spec files. */
export const ASYNCAPI_SPEC_VERSION = '3.0.0';

/** The transports the canonical `spec/asyncapi/` directory publishes. */
export const ASYNCAPI_TRANSPORTS = ['websocket', 'grpc'];

/** Canonical proto conventions (spec/asyncapi/async-api.proto). */
export const PROTO_PACKAGE = 'realtime';
export const PROTO_SERVICE = 'AsyncApiGateway';
export const PROTO_REQUEST_MESSAGE = 'AsyncApiRequest';
export const PROTO_RESPONSE_MESSAGE = 'AsyncApiResponse';

const TRANSPORT_SERVER = {
  websocket: {
    protocol: 'ws',
    portKey: 'websocket',
    defaultPort: 3001,
    title: 'WebSocket',
    description: 'WebSocket endpoint.'
  },
  grpc: {
    protocol: 'grpc',
    portKey: 'grpc',
    defaultPort: 3002,
    title: 'gRPC',
    description: 'gRPC endpoint.'
  }
};

/** Every message contract in the model, flattened with its owner context. */
function collectContracts(state) {
  const entries = [];
  (state.domains || []).forEach((domain) => {
    (domain.entities || []).forEach((entity) => {
      const contracts = Array.isArray(entity?.meta?.contracts) ? entity.meta.contracts : [];
      contracts.forEach((contract) => {
        entries.push({ domain, entity, contract });
      });
    });
  });
  return entries;
}

/** Channel address: the explicit channel or the `<domain>/<entity>/<type>` fallback. */
function channelAddress(domain, entity, contract) {
  return String(contract.channel || '').trim()
    || `${toPathToken(domain.name)}/${toPathToken(entity.name)}/${contract.type}`;
}

/** AsyncAPI map keys allow letters, digits and `._-/` — everything else becomes `-`. */
function toMapKey(value) {
  return String(value).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_.\-/]/g, '-');
}

/** PascalCase identifier for proto/AsyncAPI component names. */
function toPascalCase(value) {
  const words = String(value || '').split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const name = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
  return name || 'Contract';
}

/** Component name for a contract message: `<Domain>_<Entity>_<Contract>`. */
function messageComponentName(domain, entity, contract) {
  return `${toSchemaName(domain.name, entity.name)}_${toPascalCase(contract.name)}`;
}

/**
 * Registers `payloadSchema` under `components.schemas` and returns the schema
 * name. Structurally identical payloads share the first registered entry —
 * the shared-reference discipline instead of inline duplicates.
 */
function registerPayloadSchema(schemas, messageName, payloadSchema) {
  const payload = payloadSchema && typeof payloadSchema === 'object' ? payloadSchema : {};
  const fingerprint = JSON.stringify(payload);
  const existing = Object.keys(schemas).find((name) => JSON.stringify(schemas[name]) === fingerprint);
  if (existing) return existing;
  const schemaName = `${messageName}Payload`;
  schemas[schemaName] = payload;
  return schemaName;
}

/**
 * Builds the AsyncAPI 3.0 document for one transport, following the
 * `spec/asyncapi/<version>.<transport>.yml` structure: channels carry
 * `address` + message `$ref`s, the top-level `operations` map carries
 * `action` (`receive` for `response` contracts, `send` otherwise) with
 * channel/message `$ref`s, and payloads are shared `components.schemas`
 * entries referenced from `components.messages`.
 */
export function buildAsyncApiTransportDocument(state, transport, options = {}) {
  const server = TRANSPORT_SERVER[transport] || TRANSPORT_SERVER.websocket;
  const version = String(options.version || '').trim() || '1.0.0';
  const port = Number(state?.serviceConfiguration?.ports?.[server.portKey]) || server.defaultPort;

  const channels = {};
  const operations = {};
  const messages = {};
  const schemas = {};

  collectContracts(state).forEach(({ domain, entity, contract }) => {
    const address = channelAddress(domain, entity, contract);
    const channelKey = toMapKey(address);
    const messageName = messageComponentName(domain, entity, contract);
    const messageKey = toMapKey(contract.name || messageName);
    const schemaName = registerPayloadSchema(schemas, messageName, contract.payloadSchema);

    if (!channels[channelKey]) {
      channels[channelKey] = { address, messages: {} };
    }
    channels[channelKey].messages[messageKey] = {
      $ref: `#/components/messages/${messageName}`
    };
    messages[messageName] = {
      name: messageName,
      payload: { $ref: `#/components/schemas/${schemaName}` }
    };

    const operationId = `${contract.type}_${messageName}`;
    operations[operationId] = {
      action: contract.type === 'response' ? 'receive' : 'send',
      channel: { $ref: `#/channels/${channelKey}` },
      messages: [{ $ref: `#/channels/${channelKey}/messages/${messageKey}` }]
    };
  });

  return {
    asyncapi: ASYNCAPI_SPEC_VERSION,
    info: {
      title: `Domain Designer ${server.title} API`,
      version,
      description: `AsyncAPI contract for ${server.title} communication exported from the Domain Designer model.`
    },
    defaultContentType: 'application/json',
    servers: {
      local: {
        host: `localhost:${port}`,
        protocol: server.protocol,
        description: server.description
      }
    },
    channels,
    operations,
    components: { messages, schemas }
  };
}

/* --------------------------------------------------------------------------
 * Minimal YAML emitter. The designer SPA runs without a bundler, so the
 * `yaml` package is unavailable in the browser; the emitted documents only
 * contain plain maps, lists and scalars, which this covers. Strings that are
 * not safe as plain scalars fall back to JSON double-quoted style, which is
 * valid YAML — the suites parse every emission back with the real parser.
 * ------------------------------------------------------------------------ */

const YAML_KEYWORDS = new Set(['null', 'true', 'false', 'yes', 'no', 'on', 'off', '~']);

function isPlainSafeString(value) {
  if (!value || YAML_KEYWORDS.has(value.toLowerCase())) return false;
  if (!/^[^\s[\]{}&,*!|>'"%@`#?:-]/.test(value) && !/^[-?:][^\s]/.test(value)) return false;
  if (/:(\s|$)/.test(value) || /\s#/.test(value) || /\s$/.test(value)) return false;
  if (!/^[ -~]+$/.test(value)) return false;
  return !Number.isFinite(Number(value));
}

function toYamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value);
  return isPlainSafeString(text) ? text : JSON.stringify(text);
}

function toYamlLines(value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return [`${pad}[]`];
    return value.flatMap((item) => {
      if (item !== null && typeof item === 'object') {
        const lines = toYamlLines(item, indent + 2);
        return [`${pad}- ${lines[0].trimStart()}`, ...lines.slice(1)];
      }
      return [`${pad}- ${toYamlScalar(item)}`];
    });
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return [`${pad}{}`];
    return entries.flatMap(([key, entryValue]) => {
      const renderedKey = toYamlScalar(key);
      if (entryValue !== null && typeof entryValue === 'object'
        && (Array.isArray(entryValue) ? entryValue.length : Object.keys(entryValue).length)) {
        return [`${pad}${renderedKey}:`, ...toYamlLines(entryValue, indent + 2)];
      }
      if (entryValue !== null && typeof entryValue === 'object') {
        return [`${pad}${renderedKey}: ${Array.isArray(entryValue) ? '[]' : '{}'}`];
      }
      return [`${pad}${renderedKey}: ${toYamlScalar(entryValue)}`];
    });
  }
  return [`${pad}${toYamlScalar(value)}`];
}

/** Serializes a plain-object document to block-style YAML text. */
export function toYaml(document) {
  return `${toYamlLines(document, 0).join('\n')}\n`;
}

/**
 * The per-transport export file set, ready for the download glue: one
 * `<version>.<transport>.yml` file per canonical transport, named exactly as
 * the `spec/asyncapi/` convention so an exported file drops into the
 * canonical location.
 */
export function buildAsyncApiFileSet(state, options = {}) {
  const version = String(options.version || '').trim() || '1.0.0';
  return {
    version,
    files: ASYNCAPI_TRANSPORTS.map((transport) => ({
      fileName: `${version}.${transport}.yml`,
      mimeType: 'application/yaml',
      content: toYaml(buildAsyncApiTransportDocument(state, transport, { version }))
    }))
  };
}

/* --------------------------------------------------------------------------
 * gRPC proto export, aligned with spec/asyncapi/async-api.proto conventions.
 * ------------------------------------------------------------------------ */

const PROTO_SCALAR_TYPES = {
  string: 'string',
  integer: 'int64',
  number: 'double',
  boolean: 'bool',
  date: 'string',
  datetime: 'string',
  uuid: 'string'
};

/** proto identifier: letters, digits and `_`, never leading with a digit. */
function toProtoIdentifier(value) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_]/g, '_');
  const identifier = cleaned || 'field';
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier;
}

/**
 * Maps a JSON-schema property to a proto field line. Objects (and anything
 * unknown) travel as JSON-encoded strings — the canonical envelope's `*Json`
 * convention — arrays become `repeated` scalar fields.
 */
function toProtoFieldLine(propertyName, propertySchema, fieldNumber) {
  const schema = propertySchema && typeof propertySchema === 'object' ? propertySchema : {};
  let protoType = PROTO_SCALAR_TYPES[schema.type] || 'string';
  if (schema.type === 'array') {
    const items = schema.items && typeof schema.items === 'object' ? schema.items : {};
    protoType = `repeated ${PROTO_SCALAR_TYPES[items.type] || 'string'}`;
  }
  return `  ${protoType} ${toProtoIdentifier(propertyName)} = ${fieldNumber};`;
}

/** One proto message per contract, fields derived from the payload schema. */
function buildProtoMessage(messageName, payloadSchema) {
  const properties = payloadSchema && typeof payloadSchema === 'object'
    && payloadSchema.properties && typeof payloadSchema.properties === 'object'
    ? payloadSchema.properties
    : {};
  const lines = [`message ${messageName} {`];
  Object.keys(properties).forEach((propertyName, index) => {
    lines.push(toProtoFieldLine(propertyName, properties[propertyName], index + 1));
  });
  lines.push('}');
  return lines.join('\n');
}

/** The canonical envelope messages, verbatim from spec/asyncapi/async-api.proto. */
function canonicalEnvelopeMessages() {
  return [
    'message AsyncApiRequest {',
    '  string version = 1;',
    '  string operationId = 2;',
    '  string authorization = 3;',
    '  string inputJson = 4;',
    '  string paramsJson = 5;',
    '  string queryStringJson = 6;',
    '  string metadataJson = 7;',
    '  string requestId = 8;',
    '  string clientId = 9;',
    '}',
    '',
    'message AsyncApiResponse {',
    '  bool ok = 1;',
    '  string version = 2;',
    '  string operationId = 3;',
    '  string resultJson = 4;',
    '  string errorName = 5;',
    '  string errorMessage = 6;',
    '  string requestId = 7;',
    '  string clientId = 8;',
    '  string metadataJson = 9;',
    '}'
  ].join('\n');
}

/**
 * Builds the gRPC proto aligned with `spec/asyncapi/async-api.proto`:
 * proto3 syntax, package `realtime`, service `AsyncApiGateway`.
 *
 * - `request` contracts become unary rpcs; the return message is the
 *   `response` contract on the same channel, or the canonical
 *   `AsyncApiResponse` envelope when no response pairs with it.
 * - Unpaired `response` contracts take the canonical `AsyncApiRequest`
 *   envelope as their argument.
 * - `event`/`command` contracts become bidirectional streaming rpcs, the
 *   canonical `Exchange` convention.
 * - A model without contracts yields exactly the canonical gateway — the
 *   export is a drop-in replacement for the checked-in proto.
 */
export function buildGrpcProto(state, options = {}) {
  const packageName = String(options.packageName || '').trim() || PROTO_PACKAGE;
  const serviceName = String(options.serviceName || '').trim() || PROTO_SERVICE;
  const entries = collectContracts(state);

  const sections = ['syntax = "proto3";', '', `package ${packageName};`, ''];

  if (!entries.length) {
    sections.push(`service ${serviceName} {`);
    sections.push(`  rpc Request (${PROTO_REQUEST_MESSAGE}) returns (${PROTO_RESPONSE_MESSAGE});`);
    sections.push(`  rpc Exchange (stream ${PROTO_REQUEST_MESSAGE}) returns (stream ${PROTO_RESPONSE_MESSAGE});`);
    sections.push('}');
    sections.push('');
    sections.push(canonicalEnvelopeMessages());
    return `${sections.join('\n')}\n`;
  }

  const rpcLines = [];
  const messageSections = [];
  let usesRequestEnvelope = false;
  let usesResponseEnvelope = false;

  const messageNameFor = ({ domain, entity, contract }) => (
    `${toPascalCase(toSchemaName(domain.name, entity.name))}${toPascalCase(contract.name)}`
  );
  const pairedResponse = (entry) => entries.find((candidate) => (
    candidate.contract.type === 'response'
    && channelAddress(candidate.domain, candidate.entity, candidate.contract)
      === channelAddress(entry.domain, entry.entity, entry.contract)
  ));
  const hasRequestPair = (entry) => entries.some((candidate) => (
    candidate.contract.type === 'request'
    && channelAddress(candidate.domain, candidate.entity, candidate.contract)
      === channelAddress(entry.domain, entry.entity, entry.contract)
  ));

  entries.forEach((entry) => {
    const rpcName = toPascalCase(entry.contract.name);
    const messageName = messageNameFor(entry);
    messageSections.push(buildProtoMessage(messageName, entry.contract.payloadSchema));
    if (entry.contract.type === 'request') {
      const response = pairedResponse(entry);
      if (response) {
        rpcLines.push(`  rpc ${rpcName} (${messageName}) returns (${messageNameFor(response)});`);
      } else {
        usesResponseEnvelope = true;
        rpcLines.push(`  rpc ${rpcName} (${messageName}) returns (${PROTO_RESPONSE_MESSAGE});`);
      }
      return;
    }
    if (entry.contract.type === 'response') {
      if (hasRequestPair(entry)) return; // already the return side of its request rpc
      usesRequestEnvelope = true;
      rpcLines.push(`  rpc ${rpcName} (${PROTO_REQUEST_MESSAGE}) returns (${messageName});`);
      return;
    }
    rpcLines.push(`  rpc ${rpcName} (stream ${messageName}) returns (stream ${messageName});`);
  });

  sections.push(`service ${serviceName} {`);
  sections.push(...rpcLines);
  sections.push('}');
  sections.push('');
  if (usesRequestEnvelope || usesResponseEnvelope) {
    const envelopes = canonicalEnvelopeMessages().split('\n\n');
    const requested = [];
    if (usesRequestEnvelope) requested.push(envelopes[0]);
    if (usesResponseEnvelope) requested.push(envelopes[1]);
    sections.push(requested.join('\n\n'));
    sections.push('');
  }
  sections.push(messageSections.join('\n\n'));
  return `${sections.join('\n')}\n`;
}
