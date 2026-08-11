/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable class-methods-use-this */
import { createServer, Server } from 'http';
import fs from 'fs';
import path from 'path';
import { _HTTP_PORT_ } from '@src/config/constants';
import type {
  IHTTPRequest,
  IHTTPResponse,
  IbaseHandler
} from '@src/interface/HTTP/ports';
import {
  HTTPBaseServer
} from '@src/interface/HTTP/ports';

export type TotalJsRequest = IHTTPRequest;
export type TotalJsResponse = {
  status: (statusCode: number) => TotalJsResponse;
  json: (payload: any) => any;
  send?: (payload: any) => any;
} & IHTTPResponse;

let totalJsServer: HTTPBaseServer<any> | undefined;

class TotalJsServer extends HTTPBaseServer<any> {
  public readonly application: any = {};

  private readonly router: any;

  private server: Server | undefined;

  private staticDocs: Record<string, Map<string, string>> = {};

  private static getContentType(fileName: string): string {
    if (fileName.endsWith('.html')) return 'text/html; charset=utf-8';
    if (fileName.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (fileName.endsWith('.css')) return 'text/css; charset=utf-8';
    if (fileName.endsWith('.json')) return 'application/json; charset=utf-8';
    if (fileName.endsWith('.svg')) return 'image/svg+xml';
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
    return 'text/plain; charset=utf-8';
  }

  private static normalizeDocRequestPath(rawUrl: string, prefix: string): string {
    const pathname = rawUrl.split('?')[0];
    const trimmed = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
    const candidate = trimmed.replace(/^\/+/, '') || 'index.html';
    const normalized = path.posix.normalize(`/${candidate}`).replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return '';
    return normalized;
  }

  private loadStaticDocManifest(docFolder: string): Map<string, string> {
    const manifest = new Map<string, string>();
    const absoluteFolder = path.resolve(process.cwd(), docFolder);
    if (!fs.existsSync(absoluteFolder)) return manifest;

    const walk = (currentPath: string) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      entries.forEach((entry) => {
        const absoluteEntryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          walk(absoluteEntryPath);
          return;
        }
        const relative = path.relative(absoluteFolder, absoluteEntryPath).split(path.sep).join('/');
        manifest.set(relative, absoluteEntryPath);
      });
    };

    walk(absoluteFolder);
    return manifest;
  }

  constructor() {
    super();
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Router = require('find-my-way');
    this.router = Router();

    // Prime Total.js package if installed (optional, runtime-pluggable).
    try {
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      this.application.total = require('total4');
    } catch (error) {
      this.application.total = null;
    }
  }

  private createResponseAdapter(response: any): any {
    return {
      status(code: number) {
        response.statusCode = code;
        return this;
      },
      json(payload: any) {
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(payload));
        return payload;
      },
      send(payload: any) {
        if (typeof payload === 'object') {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(payload));
          return payload;
        }
        response.end(payload);
        return payload;
      }
    };
  }

  private async readBody(request: any): Promise<any> {
    const method = (request.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return {};

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      request.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      request.on('end', () => resolve());
      request.on('error', (error: Error) => reject(error));
    });

    if (!chunks.length) return {};
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  public endPointRegister(handlerFactory: IbaseHandler): void {
    this.router.on(
      handlerFactory.method.toUpperCase(),
      handlerFactory.path,
      async (request: any, response: any, params: Record<string, any>) => {
        const body = await this.readBody(request);
        const req = {
          ...request,
          params,
          query: request.query || {},
          headers: request.headers || {},
          body
        };
        const res = this.createResponseAdapter(response);
        await handlerFactory.handler(req, res);
      }
    );
  }

  private registerStaticDocsRoutes(): void {
    this.staticDocs.OASdoc = this.loadStaticDocManifest('apps/backend-template/OASdoc');
    this.staticDocs.AsyncAPIdoc = this.loadStaticDocManifest('apps/backend-template/AsyncAPIdoc');
    const register = (prefix: string, docFolder: string) => {
      const manifestKey = prefix.replace('/', '');
      this.router.on('GET', `${prefix}/*`, async (request: any, response: any) => {
        const normalizedPath = TotalJsServer.normalizeDocRequestPath(request.url || '', prefix);
        const manifest = this.staticDocs[manifestKey] || this.loadStaticDocManifest(docFolder);
        const absolutePath = normalizedPath ? manifest.get(normalizedPath) : undefined;
        if (!absolutePath || !fs.existsSync(absolutePath)) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        response.statusCode = 200;
        response.setHeader('content-type', TotalJsServer.getContentType(absolutePath));
        response.end(fs.readFileSync(absolutePath));
      });
    };

    register('/OASdoc', 'apps/backend-template/OASdoc');
    register('/AsyncAPIdoc', 'apps/backend-template/AsyncAPIdoc');
    this.router.on('GET', '/docs/asyncapi', async (_request: any, response: any) => {
      response.statusCode = 302;
      response.setHeader('location', '/AsyncAPIdoc');
      response.end();
    });
  }

  public async start(): Promise<void> {
    this.registerStaticDocsRoutes();
    this.server = createServer((req, res) => {
      this.router.lookup(req, res);
    });
    await new Promise<void>((resolve) => {
      this.server!.listen(_HTTP_PORT_, resolve);
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
  }

  public static compile(): HTTPBaseServer<any> {
    if (!totalJsServer) {
      totalJsServer = new TotalJsServer();
    }
    return totalJsServer;
  }
}

export { TotalJsServer };
