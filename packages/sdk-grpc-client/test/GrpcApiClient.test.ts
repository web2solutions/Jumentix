import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {
  GrpcApiClient, interopDefault, loadSpecs, resolveGrpcProtoPath
} from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The client is exercised against a real gRPC server: a real `grpc.Server`
 * bound to an ephemeral port on the loopback interface, loading the same
 * `async-api.proto` the client loads. Nothing is substituted for the transport,
 * so the request encoding, the JSON round trip and the error mapping are
 * checked against the wire format an actual server would see — which is the
 * only place a wrong field name or a missing `_json` suffix ever shows up.
 *
 * The path resolver and the spec loader work on real files under the OS temp
 * directory, for the same reason.
 */

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const PROTO_PATH = path.join(REPOSITORY_ROOT, 'spec', 'asyncapi', 'async-api.proto');

/** Scratch directories created by a test, removed when it ends. */
const created: string[] = [];

function scratch(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `grpc-sdk-${prefix}-`));
  created.push(dir);
  return dir;
}

type ServerReply = {
  ok?: boolean;
  version?: string;
  operationId?: string;
  resultJson?: string;
  errorName?: string;
  errorMessage?: string;
};

type Recorded = Record<string, string>;

/**
 * What a gRPC handler must pass to fail a call: an `Error` carrying a status
 * code. A plain object is dropped, and so is an Error without a code — in both
 * cases the call never completes and the caller waits forever, which is worth
 * knowing about the transport this client sits on.
 */
type ServiceFailure = Error & { code: number };

/**
 * A real gRPC server on a real port.
 *
 * `handler` decides what it answers with, which is how the failure paths are
 * reached: a server that returns `ok: false`, or one that fails the call
 * outright, is a server — not a stand-in for one.
 */
async function serving(
  handler: (request: Recorded) => ServerReply | ServiceFailure
): Promise<{ host: string; received: Recorded[]; stop: () => Promise<void> }> {
  const loader = interopDefault(protoLoader) as typeof protoLoader;
  const grpcLib = interopDefault(grpc) as typeof grpc;

  const definition = loader.loadSync(PROTO_PATH, {
    longs: String, enums: String, defaults: true, oneofs: true
  });
  const loaded = grpcLib.loadPackageDefinition(definition) as never as {
    realtime: { AsyncApiGateway: { service: grpc.ServiceDefinition } };
  };

  const received: Recorded[] = [];
  const server = new grpcLib.Server();

  server.addService(loaded.realtime.AsyncApiGateway.service, {
    request: (
      call: { request: Recorded },
      callback: (error: ServiceFailure | null, reply?: ServerReply) => void
    ) => {
      received.push(call.request);
      const answer = handler(call.request);
      if ('code' in answer) {
        callback(answer);
        return;
      }
      callback(null, answer);
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpcLib.ServerCredentials.createInsecure(), (error, bound) => {
      if (error) reject(error);
      else resolve(bound);
    });
  });

  return {
    host: `127.0.0.1:${port}`,
    received,
    // `forceShutdown`, not `tryShutdown`: the graceful path waits for every
    // client channel to drain, and a channel left open by a failed call never
    // does — the suite hung on teardown while the assertion itself had already
    // passed.
    stop: async () => { server.forceShutdown(); }
  };
}

/** Everything a happy server answers with. */
const complete = (over: ServerReply = {}): ServerReply => ({
  ok: true,
  version: '1.0.0',
  operationId: 'listUsers',
  resultJson: JSON.stringify({ items: [1, 2] }),
  ...over
});

// A file-level hook: every scratch directory in this file is removed by the
// same teardown, and per-describe copies would be three chances to leave one
// behind in the OS temp directory.
// eslint-disable-next-line jest/require-top-level-describe
afterEach(() => {
  while (created.length > 0) {
    fs.rmSync(created.pop() as string, { recursive: true, force: true });
  }
});

describe('interopDefault', () => {
  /**
   * Both shapes occur across the runtimes this SDK is published for, and the
   * wrong one throws on the first property access with a message that names
   * neither module.
   */
  it('unwraps a namespace whose default holds the exports', () => {
    expect.hasAssertions();

    const exports = { loadSync: () => {} };

    expect(interopDefault({ default: exports })).toBe(exports);
  });

  it('leaves a namespace that is already the exports alone', () => {
    expect.hasAssertions();

    const exports = { loadSync: () => {} };

    expect(interopDefault(exports)).toBe(exports);
  });

  it('does not unwrap a falsy-but-present default', () => {
    expect.hasAssertions();

    const namespace = { default: 0 };

    // `??`, not `||`: a module whose default is 0 or '' is still its default.
    expect(interopDefault(namespace)).toBe(0);
  });
});

describe('resolveGrpcProtoPath', () => {
  it('accepts an explicit path that exists', () => {
    expect.hasAssertions();

    const dir = scratch('explicit');
    const file = path.join(dir, 'async-api.proto');
    fs.writeFileSync(file, 'syntax = "proto3";\n', 'utf8');

    expect(resolveGrpcProtoPath(file)).toBe(path.resolve(file));
  });

  /**
   * A configured path that does not exist must fail loudly. Falling back to a
   * search would load a different proto than the one the operator asked for,
   * and the mismatch surfaces as an unimplemented method at call time.
   */
  it('refuses an explicit path that does not exist, naming it', () => {
    expect.hasAssertions();

    const missing = path.join(scratch('missing'), 'nope.proto');

    expect(() => resolveGrpcProtoPath(missing))
      .toThrow(`gRPC proto file not found at configured path: ${path.resolve(missing)}`);
  });

  it('prefers the packaged proto next to the module', () => {
    expect.hasAssertions();

    const moduleDirectory = scratch('packaged');
    fs.mkdirSync(path.join(moduleDirectory, 'proto'));
    const packaged = path.join(moduleDirectory, 'proto', 'async-api.proto');
    fs.writeFileSync(packaged, 'syntax = "proto3";\n', 'utf8');

    expect(resolveGrpcProtoPath(undefined, moduleDirectory)).toBe(packaged);
  });

  /**
   * The walk up the tree is what makes the SDK work from a workspace checkout,
   * where the proto lives at the repository root rather than in the package.
   */
  it('walks up to find the canonical proto in a parent directory', () => {
    expect.hasAssertions();

    const root = scratch('canonical');
    fs.mkdirSync(path.join(root, 'spec', 'asyncapi'), { recursive: true });
    const canonical = path.join(root, 'spec', 'asyncapi', 'async-api.proto');
    fs.writeFileSync(canonical, 'syntax = "proto3";\n', 'utf8');

    const deep = path.join(root, 'packages', 'sdk-grpc-client', 'dist');
    fs.mkdirSync(deep, { recursive: true });

    expect(resolveGrpcProtoPath(undefined, deep)).toBe(canonical);
  });

  it('names both artifacts it looked for when neither exists', () => {
    expect.hasAssertions();

    // A directory under the OS temp root, which has no `spec/asyncapi` anywhere
    // above it.
    const isolated = scratch('nothing');

    expect(() => resolveGrpcProtoPath(undefined, isolated))
      .toThrow(/spec\/asyncapi\/async-api\.proto.*proto\/async-api\.proto/s);
  });

  it('finds the repository proto from its own module directory', () => {
    expect.hasAssertions();

    // The default argument, and the path every production caller takes.
    expect(fs.existsSync(resolveGrpcProtoPath())).toBe(true);
  });
});

describe('loadSpecs', () => {
  it('parses the AsyncAPI gRPC document from the directory it is given', () => {
    expect.hasAssertions();

    const base = scratch('spec');
    fs.mkdirSync(path.join(base, 'asyncapi'));
    fs.writeFileSync(
      path.join(base, 'asyncapi', '1.0.0.grpc.yml'),
      'servers:\n  local:\n    host: example.test:9999\n',
      'utf8'
    );

    expect(loadSpecs(base).asyncApiGrpc).toStrictEqual({
      servers: { local: { host: 'example.test:9999' } }
    });
  });

  it('reads the repository spec when given no directory', () => {
    expect.hasAssertions();

    // The default argument: the canonical spec resolved from the module
    // directory, independent of the current working directory.
    expect(loadSpecs().asyncApiGrpc).toBeDefined();
  });

  it('fails rather than returning an empty spec when the document is absent', () => {
    expect.hasAssertions();

    expect(() => loadSpecs(scratch('empty'))).toThrow(/ENOENT/);
  });

  it('fails when no canonical spec exists above the module directory', () => {
    expect.hasAssertions();

    // An isolated directory under the OS temp root has no `spec/asyncapi`
    // anywhere above it, so the default walk-up finds nothing.
    expect(() => loadSpecs(undefined, scratch('nothing')))
      .toThrow(/1\.0\.0\.grpc\.yml/);
  });
});

describe('the client against a real server', () => {
  it('sends the operation and resolves with the parsed result', async () => {
    expect.hasAssertions();

    const server = await serving(() => complete());

    try {
      const client = new GrpcApiClient(server.host, PROTO_PATH);
      const response = await client.request({
        operationId: 'listUsers',
        version: '1.0.0',
        authorization: 'Bearer token',
        input: { page: 1 },
        params: { id: '7' },
        queryString: { active: true },
        metadata: { trace: 'abc' }
      });

      expect(response).toStrictEqual({
        ok: true,
        version: '1.0.0',
        operationId: 'listUsers',
        result: { items: [1, 2] },
        error: undefined
      });

      // The wire shape, as the server received it. Every payload field is a
      // JSON string with a `Json` suffix; getting one wrong is invisible until
      // a server tries to parse it.
      expect(server.received[0]).toMatchObject({
        version: '1.0.0',
        operationId: 'listUsers',
        authorization: 'Bearer token',
        inputJson: JSON.stringify({ page: 1 }),
        paramsJson: JSON.stringify({ id: '7' }),
        queryStringJson: JSON.stringify({ active: true }),
        metadataJson: JSON.stringify({ trace: 'abc' })
      });
    } finally {
      await server.stop();
    }
  });

  /**
   * proto3 has no null: an omitted field arrives as an empty string, so the
   * client must send `'{}'` rather than nothing for the payloads it was not
   * given. A server calling `JSON.parse('')` throws.
   */
  it('sends empty objects and empty strings for what it was not given', async () => {
    expect.hasAssertions();

    const server = await serving(() => complete());

    try {
      await new GrpcApiClient(server.host, PROTO_PATH).request({ operationId: 'listUsers' });

      expect(server.received[0]).toStrictEqual(expect.objectContaining({
        version: '',
        authorization: '',
        inputJson: '{}',
        paramsJson: '{}',
        queryStringJson: '{}',
        metadataJson: '{}'
      }));
    } finally {
      await server.stop();
    }
  });

  it('resolves with an undefined result when the server sends no result', async () => {
    expect.hasAssertions();

    const server = await serving(() => complete({ resultJson: '' }));

    try {
      const response = await new GrpcApiClient(server.host, PROTO_PATH)
        .request({ operationId: 'listUsers' });

      // Not `JSON.parse('')`, which throws, and not `null`.
      expect(response.result).toBeUndefined();
    } finally {
      await server.stop();
    }
  });

  it('rejects with the message a refusing server reports', async () => {
    expect.hasAssertions();

    const server = await serving(() => ({
      ok: false,
      operationId: 'listUsers',
      errorName: 'Forbidden',
      errorMessage: 'not your data'
    }));

    try {
      await expect(new GrpcApiClient(server.host, PROTO_PATH).request({ operationId: 'listUsers' }))
        .rejects.toThrow('not your data');
    } finally {
      await server.stop();
    }
  });

  /** A refusal with no message must still be an error, not a silent success. */
  it('rejects with a fallback message when the refusal carries none', async () => {
    expect.hasAssertions();

    const server = await serving(() => ({ ok: false, operationId: 'listUsers' }));

    try {
      await expect(new GrpcApiClient(server.host, PROTO_PATH).request({ operationId: 'listUsers' }))
        .rejects.toThrow('gRPC operation failed');
    } finally {
      await server.stop();
    }
  });

  it('rejects when the call itself fails', async () => {
    expect.hasAssertions();

    const grpcLib = interopDefault(grpc) as typeof grpc;
    const server = await serving(() => Object.assign(
      new Error('handler exploded'),
      { code: grpcLib.status.INTERNAL }
    ));

    try {
      await expect(new GrpcApiClient(server.host, PROTO_PATH).request({ operationId: 'listUsers' }))
        .rejects.toThrow('13 INTERNAL: handler exploded');
    } finally {
      await server.stop();
    }
  });

  /**
   * The transport failure, against a port with nothing on it. Reported as a
   * rejection rather than a promise that never settles.
   */
  it('rejects when nothing is listening', async () => {
    expect.hasAssertions();

    // Port 1 on loopback: privileged and unbound, so the connection is refused
    // rather than accepted by something unrelated.
    const client = new GrpcApiClient('127.0.0.1:1', PROTO_PATH);

    await expect(client.request({ operationId: 'listUsers' })).rejects.toThrow(/UNAVAILABLE/);
  }, 30000);

  it('carries an error name and message through on a successful response', async () => {
    expect.hasAssertions();

    const server = await serving(() => complete({
      errorName: 'PartialFailure',
      errorMessage: 'two of three'
    }));

    try {
      const response = await new GrpcApiClient(server.host, PROTO_PATH)
        .request({ operationId: 'listUsers' });

      expect(response.error).toStrictEqual({
        name: 'PartialFailure',
        message: 'two of three'
      });
    } finally {
      await server.stop();
    }
  });
});

describe('the client host', () => {
  it('uses the host it was given', async () => {
    expect.hasAssertions();

    const server = await serving(() => complete());

    try {
      // Reaching the server at all is the assertion: a client that ignored the
      // argument would talk to the spec's host instead.
      await expect(new GrpcApiClient(server.host, PROTO_PATH).request({ operationId: 'x' }))
        .resolves.toBeDefined();
    } finally {
      await server.stop();
    }
  });

  it('falls back to the host declared in the repository spec', () => {
    expect.hasAssertions();

    const client = new GrpcApiClient(undefined, PROTO_PATH) as unknown as { host: string };
    const declared = String(loadSpecs().asyncApiGrpc.servers.local.host);

    // Read from the repository's own AsyncAPI document, so a change to the
    // declared port fails here rather than in whatever tries to connect.
    expect(client.host).toBe(declared);
  });
});
