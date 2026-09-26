import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

import { HTTP_PORT } from '@src/config/constants';
import { RealtimeAPIBase } from '@src/interface/Async/RealtimeAPIBase';
import { resolveGrpcProtoPath } from '@src/interface/gRPC/resolveGrpcProtoPath';

import type { sendUnaryData, ServerDuplexStream, ServerUnaryCall } from '@grpc/grpc-js';

import type {
  IAsyncOperationRequest,
  IAsyncOperationResponse,
  IRealtimeAPIFactory
} from '@src/interface/Async/RealtimeAPIBase';

/**
 * Unwrap a CommonJS interop namespace.
 *
 * Depending on how the consumer's bundler or runtime performs interop,
 * `import * as x` over a CommonJS module yields either the module's exports
 * directly or a namespace whose `default` holds them. Both shapes appear in
 * practice across the runtimes this template supports.
 *
 * Exported so the fallback can be asserted directly. It was previously reached
 * by assigning `undefined` over the live module namespace, which Bun rejects —
 * an ES module namespace is read-only there — so that test ran only under Jest
 * (JUM-583).
 */
export function interopDefault<T>(moduleNamespace: T): T {
  return (moduleNamespace as { default?: T }).default ?? moduleNamespace;
}

export interface IGrpcAPIFactory extends IRealtimeAPIFactory {
  host?: string;
  port?: number;
  protoFilePath?: string;
}

interface IGrpcAsyncApiRequest {
  version?: string;
  operationId: string;
  requestId?: string;
  clientId?: string;
  authorization?: string;
  inputJson?: string;
  paramsJson?: string;
  queryStringJson?: string;
  metadataJson?: string;
}

interface IGrpcAsyncApiResponse {
  ok: boolean;
  version?: string;
  operationId: string;
  requestId?: string;
  clientId?: string;
  metadataJson?: string;
  resultJson?: string;
  errorName?: string;
  errorMessage?: string;
}

export class GrpcAPI extends RealtimeAPIBase {
  private readonly host: string;

  private readonly port: number;

  private readonly protoFilePath: string;

  private server?: Server;

  constructor(config: IGrpcAPIFactory) {
    super({
      ...config,
      interfaceType: 'grpcapi',
      frameworkName: 'grpc'
    });
    this.host = config.host || '0.0.0.0';
    this.port = config.port || Number(process.env.JUMENTIX_GRPC_PORT || HTTP_PORT + 2);
    this.protoFilePath = resolveGrpcProtoPath(config.protoFilePath);
  }

  private static parseJson(raw?: string): Record<string, any> {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  }

  private static toGrpcResponse(response: IAsyncOperationResponse): IGrpcAsyncApiResponse {
    const requestId = response.metadata?.requestId;
    const clientId = response.metadata?.clientId;
    return {
      ok: response.ok,
      version: response.version,
      operationId: response.operationId,
      requestId,
      clientId,
      metadataJson: response.metadata ? JSON.stringify(response.metadata) : undefined,
      resultJson: response.result === undefined ? undefined : JSON.stringify(response.result),
      errorName: response.error?.name,
      errorMessage: response.error?.message
    };
  }

  private static toDomainRequest(request: IGrpcAsyncApiRequest): IAsyncOperationRequest {
    const metadataFromJson = GrpcAPI.parseJson(request.metadataJson);
    return {
      version: request.version,
      operationId: request.operationId,
      authorization: request.authorization || '',
      input: GrpcAPI.parseJson(request.inputJson),
      params: GrpcAPI.parseJson(request.paramsJson),
      queryString: GrpcAPI.parseJson(request.queryStringJson),
      metadata: {
        ...metadataFromJson,
        requestId: request.requestId || metadataFromJson.requestId,
        clientId: request.clientId || metadataFromJson.clientId
      }
    };
  }

  private loadProtoService(): any {
    const packageDefinition = loadSync(this.protoFilePath, {
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const grpcObject: any = loadPackageDefinition(packageDefinition);
    return grpcObject.realtime;
  }

  public async start(): Promise<void> {
    if (this.started) return;
    if (this.keyValueStorageClient) {
      await this.keyValueStorageClient.connect();
    }
    await this.databaseClient.connect();

    const realtimePackage = this.loadProtoService();
    const server = new Server();
    this.server = server;
    server.addService(realtimePackage.AsyncApiGateway.service, {
      request: (
        call: ServerUnaryCall<IGrpcAsyncApiRequest, IGrpcAsyncApiResponse>,
        callback: sendUnaryData<IGrpcAsyncApiResponse>
      ) => {
        // Detached by contract: the gRPC callback settles the call; a
        // rejection surfaces as an unhandled rejection, as the async form did.
        this.executeOperation(GrpcAPI.toDomainRequest(call.request))
          .then((response) => {
            callback(null, GrpcAPI.toGrpcResponse(response));
          })
          .catch((error: unknown) => {
            throw error;
          });
      },
      exchange: (stream: ServerDuplexStream<IGrpcAsyncApiRequest, IGrpcAsyncApiResponse>) => {
        stream.on('data', (request: IGrpcAsyncApiRequest) => {
          // Detached by contract: each datum is answered with a stream write;
          // a rejection surfaces as an unhandled rejection, as before.
          this.executeOperation(GrpcAPI.toDomainRequest(request))
            .then((response) => {
              stream.write(GrpcAPI.toGrpcResponse(response));
            })
            .catch((error: unknown) => {
              throw error;
            });
        });
        stream.on('end', () => {
          stream.end();
        });
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.bindAsync(`${this.host}:${this.port}`, ServerCredentials.createInsecure(), (error) => {
        if (error) {
          reject(error);
          return;
        }
        server.start();
        resolve();
      });
    });

    this.started = true;
  }

  public async stop(): Promise<void> {
    if (!this.started) return;

    const { server } = this;
    if (server) {
      await new Promise<void>((resolve) => {
        server.tryShutdown(() => resolve());
      });
      this.server = undefined;
    }

    if (this.keyValueStorageClient) {
      await this.keyValueStorageClient.disconnect();
    }
    await this.databaseClient.disconnect();
    this.started = false;
  }
}

export default GrpcAPI;
