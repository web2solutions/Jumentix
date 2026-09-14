import { loadSpecs } from './spec/loadSpecs';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface IRestApiRequest {
  operationId: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Lifecycle of one SDK request (JUM-765). The SDK is the intermediary between
 * the UI and the server, so it is the authoritative source for what the UI
 * shows about network activity.
 */
export interface RestApiRequestEvent {
  type: 'request:start' | 'request:success' | 'request:error';
  operationId: string;
  method: HttpMethod;
  url: string;
  startedAt: number;
  durationMs?: number;
  status?: number;
  error?: string;
}

export type RestApiEventListener = (event: RestApiRequestEvent) => void;

const compilePath = (
  pathTemplate: string,
  pathParams?: Record<string, string | number>
): string => {
  if (!pathParams) return pathTemplate;
  return Object.entries(pathParams).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }, pathTemplate);
};

export class RestApiClient {
  private readonly baseUrl: string;

  private readonly serviceUrls = new Map<string, string>();

  private readonly operationToRoute: Map<string, {
    method: HttpMethod;
    path: string;
    serviceId?: string;
  }> = new Map();

  private readonly listeners: Set<RestApiEventListener> = new Set();

  /**
   * @param baseUrl Overrides the server declared in the spec.
   * @param specs Injected so the fallbacks below are reachable from a test. The
   * loader reads a file from disk, so without this the only spec any test can
   * see is the repository's own — and a document with no `servers` or no
   * `paths` is exactly the shape the fallbacks exist for.
   */
  constructor(baseUrl?: string, specs: typeof loadSpecs = loadSpecs) {
    const { openApi } = specs();
    const serverUrl = openApi?.servers?.[0]?.url || 'http://localhost:3000/api/1.0.0';
    this.baseUrl = baseUrl || serverUrl;

    const services = Array.isArray(openApi?.['x-services']) ? openApi['x-services'] : [];
    for (const service of services) {
      if (service?.id && service?.url) {
        this.serviceUrls.set(String(service.id), String(service.url));
      }
    }
    for (const server of openApi?.servers || []) {
      const serviceId = server?.['x-service-id'];
      if (serviceId && server?.url && !this.serviceUrls.has(String(serviceId))) {
        this.serviceUrls.set(String(serviceId), String(server.url));
      }
    }

    for (const [routePath, methods] of Object.entries(openApi.paths || {})) {
      for (const [method, config] of Object.entries(methods as Record<string, any>)) {
        const operationId = config?.operationId;
        if (operationId) {
          this.operationToRoute.set(operationId, {
            method: method as HttpMethod,
            path: routePath,
            serviceId: config['x-service']
          });
        }
      }
    }
  }

  private resolveBaseUrl(serviceId?: string): string {
    if (this.serviceUrls.size <= 1 && this.baseUrl) {
      return this.baseUrl;
    }
    if (serviceId && this.serviceUrls.has(serviceId)) {
      return this.serviceUrls.get(serviceId)!;
    }
    if (this.serviceUrls.has('core')) {
      return this.serviceUrls.get('core')!;
    }
    return this.baseUrl;
  }

  /** Subscribe to request lifecycle events; returns the unsubscribe function. */
  public subscribe(listener: RestApiEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RestApiRequestEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public async request<TResponse = unknown>(request: IRestApiRequest): Promise<TResponse> {
    const route = this.operationToRoute.get(request.operationId);
    if (!route) {
      throw new Error(`Operation "${request.operationId}" not found in OpenAPI spec.`);
    }

    const path = compilePath(route.path, request.pathParams);
    const url = new URL(`${this.resolveBaseUrl(route.serviceId)}${path}`);
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        url.searchParams.set(key, String(value));
      }
    }

    const startedAt = Date.now();
    this.emit({
      type: 'request:start',
      operationId: request.operationId,
      method: route.method,
      url: url.toString(),
      startedAt
    });

    try {
      const response = await fetch(url.toString(), {
        method: route.method.toUpperCase(),
        headers: {
          'content-type': 'application/json',
          ...(request.headers || {})
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body)
      });

      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        const message = await response.text();
        this.emit({
          type: 'request:error',
          operationId: request.operationId,
          method: route.method,
          url: url.toString(),
          startedAt,
          durationMs,
          status: response.status,
          error: `REST request failed: ${response.status}`
        });
        throw new Error(`REST request failed: ${response.status} ${message}`);
      }

      this.emit({
        type: 'request:success',
        operationId: request.operationId,
        method: route.method,
        url: url.toString(),
        startedAt,
        durationMs,
        status: response.status
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json() as Promise<TResponse>;
      }
      return response.text() as TResponse;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('REST request failed:')) {
        throw error;
      }
      this.emit({
        type: 'request:error',
        operationId: request.operationId,
        method: route.method,
        url: url.toString(),
        startedAt,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export default RestApiClient;
