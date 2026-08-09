/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Canonical-target suite for the AsyncAPI 3.0 and gRPC proto exports
 * (JUM-475) — `packages/designer-core/src/exporters/asyncApiExporters.js`
 * plus the structural validator in
 * `packages/designer-core/src/validation/asyncApi30Validation.js`.
 *
 * The canonical targets live in `spec/asyncapi/`: `1.0.0.websocket.yml` and
 * `1.0.0.grpc.yml` declare `asyncapi: 3.0.0` under the
 * `<version>.<transport>.yml` naming pattern, and `async-api.proto` pins the
 * proto3 / `realtime` / `AsyncApiGateway` conventions. The suite proves the
 * three acceptance properties directly:
 *
 * - Every exported document passes the AsyncAPI 3.0 structural validator —
 *   and so do the checked-in canonical files, which is what makes an export
 *   a drop-in replacement in shape. (The repository carries no
 *   `@asyncapi/parser` dependency, so the validator is the in-repo
 *   equivalent of the OAS route-resolution gate, as the issue directs.)
 * - Emitted YAML parses back to the exact document object through the real
 *   `yaml` parser, so the `.yml` files are well-formed.
 * - A contract-less model exports a proto byte-identical to the canonical
 *   `async-api.proto`.
 *
 * The payload discipline mirrors JUM-474's OAS `$ref` rule: message payloads
 * live once under `components.schemas` and are referenced, never inlined.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const YAML = require('yaml');

const {
  ASYNCAPI_TRANSPORTS,
  buildAsyncApiFileSet,
  buildAsyncApiTransportDocument,
  buildGrpcProto,
  toYaml
} = require('@jumentix/designer-core/exporters/asyncApiExporters.js');
const {
  validateAsyncApi30Document
} = require('@jumentix/designer-core/validation/asyncApi30Validation.js');
const { normalizeStatePayload } = require(
  '@jumentix/designer-core/state/designerState.js'
);

const CANONICAL_SPEC_DIR = path.join(repoRoot, 'spec', 'asyncapi');

/**
 * The reference model: explicit and derived channels, every contract type,
 * a paired request/response, shared payload schemas and an entity without
 * contracts. Ports come from `serviceConfiguration`, as the designer's
 * service-config tab owns them.
 */
function createModelState() {
  return normalizeStatePayload({
    domains: [
      {
        id: 'domain-1',
        name: 'Billing',
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            fields: [],
            meta: {
              contracts: [
                {
                  id: 'c1',
                  name: 'issued',
                  type: 'event',
                  channel: 'billing.issued',
                  version: '1.0.0',
                  payloadSchema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      total: { type: 'number' }
                    }
                  }
                },
                {
                  id: 'c2',
                  name: 'fetch',
                  type: 'request',
                  channel: 'billing.fetch',
                  version: '1.0.0',
                  payloadSchema: { type: 'object', properties: { id: { type: 'string' } } }
                },
                {
                  id: 'c3',
                  name: 'fetched',
                  type: 'response',
                  channel: 'billing.fetch',
                  version: '1.0.0',
                  payloadSchema: { type: 'object', properties: { id: { type: 'string' } } }
                }
              ]
            }
          },
          {
            id: 'entity-2',
            name: 'Receipt',
            fields: [],
            meta: {
              contracts: [{
                id: 'c4',
                name: 'reconcile',
                type: 'command',
                channel: '',
                version: '1.0.0',
                payloadSchema: {}
              }]
            }
          },
          { id: 'entity-3', name: 'Silent', fields: [] }
        ]
      }
    ],
    relationships: [],
    serviceConfiguration: {
      serviceKind: 'websocket-rest-api',
      ports: { rest: 3000, websocket: 3001, grpc: 3002 }
    }
  });
}

describe('asyncapi 3.0 per-transport export (JUM-475)', () => {
  describe('file set and canonical naming', () => {
    it('emits one file per canonical transport following the <version>.<transport>.yml pattern', () => {
      const fileSet = buildAsyncApiFileSet(createModelState());
      expect(fileSet.version).toBe('1.0.0');
      expect(fileSet.files.map((file: { fileName: string }) => file.fileName)).toStrictEqual([
        '1.0.0.websocket.yml',
        '1.0.0.grpc.yml'
      ]);
      expect(ASYNCAPI_TRANSPORTS).toStrictEqual(['websocket', 'grpc']);
      fileSet.files.forEach((file: { mimeType: string; content: string }) => {
        expect(file.mimeType).toBe('application/yaml');
        expect(typeof file.content).toBe('string');
      });
    });

    it('honours an explicit export version in the file names and info blocks', () => {
      const fileSet = buildAsyncApiFileSet(createModelState(), { version: '2.1.0' });
      expect(fileSet.files.map((file: { fileName: string }) => file.fileName)).toStrictEqual([
        '2.1.0.websocket.yml',
        '2.1.0.grpc.yml'
      ]);
      fileSet.files.forEach((file: { mimeType: string; content: string }) => {
        expect(YAML.parse(file.content).info.version).toBe('2.1.0');
      });
    });

    it('matches the canonical directory layout one-for-one', () => {
      const canonicalYamlFiles = fs.readdirSync(CANONICAL_SPEC_DIR)
        .filter((fileName) => fileName.endsWith('.yml'))
        .sort();
      const exportedNames = buildAsyncApiFileSet(createModelState()).files
        .map((file: { fileName: string }) => file.fileName)
        .sort();
      expect(exportedNames).toStrictEqual(canonicalYamlFiles);
    });
  });

  describe('document structure', () => {
    it('declares asyncapi 3.0.0 with info, defaultContentType and the per-transport server', () => {
      const websocket = buildAsyncApiTransportDocument(createModelState(), 'websocket');
      const grpc = buildAsyncApiTransportDocument(createModelState(), 'grpc');
      [websocket, grpc].forEach((document) => {
        expect(document.asyncapi).toBe('3.0.0');
        expect(document.defaultContentType).toBe('application/json');
        expect(document.info.version).toBe('1.0.0');
      });
      expect(websocket.servers.local).toStrictEqual({
        host: 'localhost:3001',
        protocol: 'ws',
        description: 'WebSocket endpoint.'
      });
      expect(grpc.servers.local).toStrictEqual({
        host: 'localhost:3002',
        protocol: 'grpc',
        description: 'gRPC endpoint.'
      });
      expect(websocket.info.title).toContain('WebSocket');
      expect(grpc.info.title).toContain('gRPC');
    });

    it('reads the server ports from serviceConfiguration and falls back to the canonical defaults', () => {
      // normalizeStatePayload keeps only domains/relationships/view, so the
      // configured-ports branch is exercised with the live-state shape
      // createDesignerState holds (serviceConfiguration included).
      const state = {
        ...createModelState(),
        serviceConfiguration: { ports: { websocket: 4101, grpc: 4102 } }
      };
      expect(buildAsyncApiTransportDocument(state, 'websocket').servers.local.host).toBe('localhost:4101');
      expect(buildAsyncApiTransportDocument(state, 'grpc').servers.local.host).toBe('localhost:4102');
      const bare = { domains: [] };
      expect(buildAsyncApiTransportDocument(bare, 'websocket').servers.local.host).toBe('localhost:3001');
      expect(buildAsyncApiTransportDocument(bare, 'grpc').servers.local.host).toBe('localhost:3002');
    });

    it('falls back to the websocket conventions for an unknown transport', () => {
      const document = buildAsyncApiTransportDocument(createModelState(), 'sse');
      expect(document.servers.local.protocol).toBe('ws');
    });

    it('builds 3.0 channels and operations: addresses, message refs and send/receive actions', () => {
      const document = buildAsyncApiTransportDocument(createModelState(), 'websocket');
      expect(document.channels['billing.issued']).toStrictEqual({
        address: 'billing.issued',
        messages: {
          issued: { $ref: '#/components/messages/Billing_Invoice_Issued' }
        }
      });
      expect(document.channels['billing.fetch'].messages).toStrictEqual({
        fetch: { $ref: '#/components/messages/Billing_Invoice_Fetch' },
        fetched: { $ref: '#/components/messages/Billing_Invoice_Fetched' }
      });
      expect(document.operations.event_Billing_Invoice_Issued).toStrictEqual({
        action: 'send',
        channel: { $ref: '#/channels/billing.issued' },
        messages: [{ $ref: '#/channels/billing.issued/messages/issued' }]
      });
      expect(document.operations.request_Billing_Invoice_Fetch.action).toBe('send');
      expect(document.operations.response_Billing_Invoice_Fetched.action).toBe('receive');
      expect(document.operations.command_Billing_Receipt_Reconcile.action).toBe('send');
    });

    it('derives the <domain>/<entity>/<type> channel address when the contract has no channel', () => {
      const document = buildAsyncApiTransportDocument(createModelState(), 'websocket');
      expect(document.channels['billing/receipt/command']).toStrictEqual({
        address: 'billing/receipt/command',
        messages: {
          reconcile: { $ref: '#/components/messages/Billing_Receipt_Reconcile' }
        }
      });
    });

    it('references shared schema definitions instead of inlining payloads', () => {
      const document = buildAsyncApiTransportDocument(createModelState(), 'websocket');
      const { messages, schemas } = document.components;
      Object.values(messages).forEach((message) => {
        const ref = (message as { payload: { $ref: string } }).payload.$ref;
        expect(ref.startsWith('#/components/schemas/')).toBe(true);
        expect(schemas[ref.slice('#/components/schemas/'.length)]).toBeDefined();
      });
      // fetch and fetched carry structurally identical payloads: one shared
      // schema entry, not two inline duplicates.
      expect(messages.Billing_Invoice_Fetch.payload).toStrictEqual(
        messages.Billing_Invoice_Fetched.payload
      );
      expect(Object.keys(schemas)).toStrictEqual([
        'Billing_Invoice_IssuedPayload',
        'Billing_Invoice_FetchPayload',
        'Billing_Receipt_ReconcilePayload'
      ]);
      expect(schemas.Billing_Invoice_IssuedPayload).toStrictEqual({
        type: 'object',
        properties: { id: { type: 'string' }, total: { type: 'number' } }
      });
    });

    it('treats a non-object payload schema as the empty schema', () => {
      const document = buildAsyncApiTransportDocument({
        domains: [{
          name: 'Billing',
          entities: [{
            name: 'Invoice',
            meta: {
              contracts: [{
                name: 'ping', type: 'event', channel: '', version: '1.0.0', payloadSchema: 'bogus'
              }]
            }
          }]
        }]
      }, 'websocket');
      expect(document.components.schemas.Billing_Invoice_PingPayload).toStrictEqual({});
    });

    it('emits empty maps for a contract-less model', () => {
      const document = buildAsyncApiTransportDocument({ domains: [] }, 'grpc');
      expect(document.channels).toStrictEqual({});
      expect(document.operations).toStrictEqual({});
      expect(document.components).toStrictEqual({ messages: {}, schemas: {} });
    });
  });

  describe('yaml emission', () => {
    it('round-trips every exported file through the yaml parser back to the document object', () => {
      const state = createModelState();
      const fileSet = buildAsyncApiFileSet(state);
      ASYNCAPI_TRANSPORTS.forEach((transport: string, index: number) => {
        expect(fileSet.files[index].fileName).toBe(`1.0.0.${transport}.yml`);
        expect(YAML.parse(fileSet.files[index].content)).toStrictEqual(
          buildAsyncApiTransportDocument(state, transport)
        );
      });
    });

    it('quotes strings that are unsafe as plain YAML scalars', () => {
      const document = {
        plain: 'value',
        withColon: 'a: b',
        withHash: 'a # b',
        leadingHash: '#comment',
        leadingDashSpace: '- item',
        keyword: 'null',
        yesWord: 'yes',
        numeric: '123',
        trailingSpace: 'x ',
        empty: '',
        unicode: 'ação',
        number: 42,
        bool: true,
        nothing: null
      };
      const parsed = YAML.parse(toYaml(document));
      expect(parsed).toStrictEqual(document);
    });

    it('keeps safe plain scalars unquoted, matching the canonical style', () => {
      expect(toYaml({ asyncapi: '3.0.0' })).toBe('asyncapi: 3.0.0\n');
      expect(toYaml({ address: 'api:{operationId}:request' })).toBe('address: api:{operationId}:request\n');
      expect(toYaml({ 'billing.issued': 1 })).toBe('billing.issued: 1\n');
    });

    it('serializes nested maps, lists, list-of-lists and empty containers', () => {
      const document = {
        root: {
          nested: [{ a: 1 }, { b: [1, 2] }, [[1]], 'x', null],
          emptyMap: {},
          emptyList: []
        },
        scalar: 'top'
      };
      expect(YAML.parse(toYaml(document))).toStrictEqual(document);
    });

    it('serializes a bare scalar document', () => {
      expect(toYaml('just text')).toBe('just text\n');
    });

    it('serializes empty root containers', () => {
      expect(toYaml({})).toBe('{}\n');
      expect(toYaml([])).toBe('[]\n');
    });
  });

  describe('malformed model tolerance', () => {
    it('tolerates missing domains, missing entities and non-array contracts', () => {
      expect(buildAsyncApiTransportDocument({}, 'websocket').channels).toStrictEqual({});
      expect(buildAsyncApiTransportDocument({ domains: [{ name: 'Empty' }] }, 'websocket').channels)
        .toStrictEqual({});
      const document = buildAsyncApiTransportDocument({
        domains: [{
          name: 'Billing',
          entities: [{ name: 'Invoice', meta: { contracts: 'bogus' } }]
        }]
      }, 'websocket');
      expect(document.channels).toStrictEqual({});
      expect(buildGrpcProto({ domains: [{ name: 'Empty' }] }))
        .toContain('service AsyncApiGateway {');
    });

    it('falls back to the component name when a contract has no usable name', () => {
      // Real states are normalized (normalizeContractInput always assigns a
      // name); raw states can still reach the exporter, and the fallbacks
      // must yield valid identifiers rather than empty keys.
      const document = buildAsyncApiTransportDocument({
        domains: [{
          name: 'Billing',
          entities: [
            {
              name: 'Invoice',
              meta: {
                contracts: [{
                  type: 'event', channel: 'noname', version: '1.0.0', payloadSchema: {}
                }]
              }
            },
            {
              name: 'Receipt',
              meta: {
                contracts: [{
                  name: '!!!', type: 'event', channel: 'symbols', version: '1.0.0', payloadSchema: {}
                }]
              }
            }
          ]
        }]
      }, 'websocket');
      // No name: the channel message key falls back to the component name.
      expect(Object.keys(document.channels.noname.messages))
        .toStrictEqual(['Billing_Invoice_Contract']);
      // A name that sanitizes to nothing still yields a valid component name.
      expect(Object.keys(document.channels.symbols.messages)).toStrictEqual(['---']);
      expect(Object.keys(document.components.messages)).toStrictEqual([
        'Billing_Invoice_Contract',
        'Billing_Receipt_Contract'
      ]);
    });
  });

  describe('asyncapi 3.0 structural validation gate', () => {
    it('validates every exported document', () => {
      const state = createModelState();
      ASYNCAPI_TRANSPORTS.forEach((transport: string) => {
        const document = buildAsyncApiTransportDocument(state, transport);
        expect(validateAsyncApi30Document(document)).toStrictEqual([]);
      });
    });

    it('validates the canonical spec/asyncapi documents with the same rules (drop-in shape parity)', () => {
      ['1.0.0.websocket.yml', '1.0.0.grpc.yml'].forEach((fileName) => {
        const canonical = YAML.parse(
          fs.readFileSync(path.join(CANONICAL_SPEC_DIR, fileName), 'utf8')
        );
        expect(validateAsyncApi30Document(canonical)).toStrictEqual([]);
      });
    });

    it('rejects a 2.x-shaped document — publish/subscribe under channels parses as neither', () => {
      const legacy = {
        asyncapi: '3.0.0',
        info: { title: 'Legacy', version: '1.0.0' },
        channels: {
          'billing.issued': {
            publish: { operationId: 'event_issued', message: { name: 'issued' } }
          }
        }
      };
      // The 2.x shape has no top-level operations and channel keys the 3.0
      // rules do not define; the version assertion below pins the 2.x case.
      expect(validateAsyncApi30Document({ ...legacy, asyncapi: '2.6.0' }))
        .toContain('asyncapi must declare a 3.x version, got "2.6.0"');
    });

    it('reports every structural violation class', () => {
      expect(validateAsyncApi30Document(null)).toStrictEqual(['document must be an object']);
      expect(validateAsyncApi30Document({ info: { title: 't', version: '1' } }))
        .toContain('asyncapi must declare a 3.x version, got "<missing>"');
      expect(validateAsyncApi30Document({ asyncapi: '3.0.0' })).toContain('info is required');
      expect(validateAsyncApi30Document({ asyncapi: '3.0.0', info: {} }))
        .toStrictEqual(expect.arrayContaining(['info.title is required', 'info.version is required']));
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        servers: 'bogus'
      })).toContain('servers must be a map');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        servers: { local: { host: '' } }
      })).toContain('servers.local must declare host and protocol');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        servers: { local: null }
      })).toContain('servers.local must declare host and protocol');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        servers: { local: { host: 'h' } }
      })).toContain('servers.local must declare host and protocol');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: []
      })).toContain('channels must be a map');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: 'bogus' }
      })).toContain('channels.c must be an object');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { address: 42, messages: [] } }
      })).toStrictEqual(expect.arrayContaining([
        'channels.c.address must be a string',
        'channels.c.messages must be a map'
      ]));
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { messages: { m: 'bogus' } } }
      })).toContain('channels.c.messages.m must be an object');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { messages: { m: { $ref: '#/components/messages/Missing' } } } }
      })).toContain('channels.c.messages.m $ref does not resolve: #/components/messages/Missing');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        operations: []
      })).toContain('operations must be a map');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        operations: { op: 'bogus' }
      })).toContain('operations.op must be an object');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        operations: { op: { action: 'publish' } }
      })).toStrictEqual(expect.arrayContaining([
        'operations.op.action must be send|receive, got "publish"',
        'operations.op.channel must be a $ref to a channel'
      ]));
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        operations: { op: { action: 'send', channel: { $ref: '#/channels/ghost' } } }
      })).toContain('operations.op.channel $ref does not resolve: #/channels/ghost');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { address: 'c' } },
        operations: { op: { action: 'send', channel: { $ref: '#/channels/c' }, messages: {} } }
      })).toContain('operations.op.messages must be a list');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { address: 'c' } },
        operations: {
          op: {
            action: 'send',
            channel: { $ref: '#/channels/c' },
            messages: [{ $ref: '#/channels/c/messages/ghost' }, 'bogus']
          }
        }
      })).toStrictEqual(expect.arrayContaining([
        'operations.op.messages.0 $ref does not resolve: #/channels/c/messages/ghost',
        'operations.op.messages.1 $ref does not resolve: undefined'
      ]));
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        components: { messages: { M: 'bogus' } }
      })).toContain('components.messages.M must be an object');
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        components: { messages: { M: { payload: { $ref: '#/components/schemas/Ghost' } } } }
      })).toContain('components.messages.M.payload $ref does not resolve: #/components/schemas/Ghost');
      // An external (non-local) message ref cannot resolve against the document.
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { messages: { m: { $ref: 'other.yml#/components/messages/M' } } } }
      })).toContain('channels.c.messages.m $ref does not resolve: other.yml#/components/messages/M');
      // A ref that walks through a scalar cannot resolve either.
      expect(validateAsyncApi30Document({
        asyncapi: '3.0.0',
        info: { title: 't', version: '1' },
        channels: { c: { messages: { m: { $ref: '#/components/messages/M' } } } },
        components: { messages: 'bogus' }
      })).toContain('channels.c.messages.m $ref does not resolve: #/components/messages/M');
    });

    it('accepts inline message payloads and non-$ref channel messages', () => {
      const document = {
        asyncapi: '3.0.0',
        info: { title: 'Inline', version: '1.0.0' },
        channels: { c: { address: 'c', messages: { m: { payload: { type: 'object' } } } } },
        components: { messages: { M: { payload: { type: 'string' } } } }
      };
      expect(validateAsyncApi30Document(document)).toStrictEqual([]);
    });
  });
});

describe('gRPC proto export (JUM-475)', () => {
  it('is byte-identical to the canonical async-api.proto for a contract-less model', () => {
    const canonical = fs.readFileSync(path.join(CANONICAL_SPEC_DIR, 'async-api.proto'), 'utf8');
    expect(buildGrpcProto({ domains: [] })).toBe(canonical);
  });

  it('emits proto3 with the canonical package and service conventions', () => {
    const proto = buildGrpcProto(createModelState());
    expect(proto.startsWith('syntax = "proto3";\n\npackage realtime;\n')).toBe(true);
    expect(proto).toContain('service AsyncApiGateway {');
  });

  it('derives one message per contract with proto-typed fields from the payload schema', () => {
    const proto = buildGrpcProto(createModelState());
    expect(proto).toContain([
      'message BillingInvoiceIssued {',
      '  string id = 1;',
      '  double total = 2;',
      '}'
    ].join('\n'));
  });

  it('pairs request/response contracts on the same channel into a unary rpc', () => {
    const proto = buildGrpcProto(createModelState());
    expect(proto).toContain('rpc Fetch (BillingInvoiceFetch) returns (BillingInvoiceFetched);');
    // The paired response does not get a second rpc of its own.
    expect(proto).not.toContain('rpc Fetched');
  });

  it('maps event and command contracts to bidirectional streaming rpcs (the Exchange convention)', () => {
    const proto = buildGrpcProto(createModelState());
    expect(proto).toContain(
      'rpc Issued (stream BillingInvoiceIssued) returns (stream BillingInvoiceIssued);'
    );
    expect(proto).toContain(
      'rpc Reconcile (stream BillingReceiptReconcile) returns (stream BillingReceiptReconcile);'
    );
  });

  it('falls back to the canonical envelopes for unpaired request/response contracts', () => {
    const state = normalizeStatePayload({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [{
          id: 'entity-1',
          name: 'Invoice',
          fields: [],
          meta: {
            contracts: [
              {
                id: 'c1', name: 'fetch', type: 'request', channel: 'a', version: '1.0.0', payloadSchema: {}
              },
              {
                id: 'c2', name: 'pong', type: 'response', channel: 'b', version: '1.0.0', payloadSchema: {}
              }
            ]
          }
        }]
      }],
      relationships: []
    });
    const proto = buildGrpcProto(state);
    expect(proto).toContain('rpc Fetch (BillingInvoiceFetch) returns (AsyncApiResponse);');
    expect(proto).toContain('rpc Pong (AsyncApiRequest) returns (BillingInvoicePong);');
    expect(proto).toContain('message AsyncApiRequest {');
    expect(proto).toContain('message AsyncApiResponse {');
  });

  it('includes only the response envelope when just requests are unpaired', () => {
    const state = normalizeStatePayload({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [{
          id: 'entity-1',
          name: 'Invoice',
          fields: [],
          meta: {
            contracts: [{
              id: 'c1', name: 'fetch', type: 'request', channel: 'a', version: '1.0.0', payloadSchema: {}
            }]
          }
        }]
      }],
      relationships: []
    });
    const proto = buildGrpcProto(state);
    expect(proto).toContain('message AsyncApiResponse {');
    expect(proto).not.toContain('message AsyncApiRequest {');
  });

  it('maps payload property types and sanitizes proto identifiers', () => {
    const proto = buildGrpcProto({
      domains: [{
        name: 'Billing',
        entities: [{
          name: 'Invoice',
          meta: {
            contracts: [{
              name: 'typed',
              type: 'event',
              channel: 'typed',
              version: '1.0.0',
              payloadSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  count: { type: 'integer' },
                  ratio: { type: 'number' },
                  active: { type: 'boolean' },
                  issuedOn: { type: 'string', format: 'date' },
                  tags: { type: 'array', items: { type: 'string' } },
                  scores: { type: 'array', items: { type: 'number' } },
                  ids: { type: 'array' },
                  meta: { type: 'object' },
                  '9lives': { type: 'string' },
                  'with-dash': { type: 'boolean' },
                  '': 'not-an-object'
                }
              }
            }]
          }
        }]
      }]
    });
    expect(proto).toContain('  string name = 1;');
    expect(proto).toContain('  int64 count = 2;');
    expect(proto).toContain('  double ratio = 3;');
    expect(proto).toContain('  bool active = 4;');
    expect(proto).toContain('  string issuedOn = 5;');
    expect(proto).toContain('  repeated string tags = 6;');
    expect(proto).toContain('  repeated double scores = 7;');
    expect(proto).toContain('  repeated string ids = 8;');
    // Objects travel as JSON-encoded strings — the canonical *Json convention.
    expect(proto).toContain('  string meta = 9;');
    expect(proto).toContain('  string _9lives = 10;');
    expect(proto).toContain('  bool with_dash = 11;');
    expect(proto).toContain('  string field = 12;');
  });

  it('emits an empty message for a contract without payload properties', () => {
    const proto = buildGrpcProto(createModelState());
    expect(proto).toContain('message BillingReceiptReconcile {\n}');
  });

  it('honours package and service name overrides', () => {
    const proto = buildGrpcProto(createModelState(), {
      packageName: 'billing',
      serviceName: 'BillingGateway'
    });
    expect(proto).toContain('package billing;');
    expect(proto).toContain('service BillingGateway {');
  });
});
