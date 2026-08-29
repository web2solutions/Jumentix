/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable class-methods-use-this */
import fs from 'fs';
import path from 'path';
import { createUuid } from '@src/modules/port/UUID';
import { _HTTP_PORT_ } from '@src/config/constants';
import { Context as RequestContext } from '@src/infra/context/Context';
import type {
  IHTTPRequest,
  IHTTPResponse,
  IbaseHandler
} from '@src/interface/HTTP/ports';
import {
  HTTPBaseServer
} from '@src/interface/HTTP/ports';

export type SailsJsRequest = IHTTPRequest;
export type SailsJsResponse = {
  status: (statusCode: number) => SailsJsResponse;
  json: (payload: any) => any;
  send?: (payload: any) => any;
} & IHTTPResponse;

let sailsJsServer: HTTPBaseServer<any> | undefined;

class SailsJsServer extends HTTPBaseServer<any> {
  public application: any = null;

  private sails: any = null;

  private readonly routes: Record<string, any> = {};

  private staticDocs: Record<string, Map<string, string>> = {};

  private static normalizeDocRequestPath(rawPath: string, prefix: string): string {
    const pathname = String(rawPath || '').split('?')[0];
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

  private registerStaticDocsRoutes(): void {
    this.staticDocs.OASdoc = this.loadStaticDocManifest('apps/backend-template/OASdoc');
    this.staticDocs.AsyncAPIdoc = this.loadStaticDocManifest('apps/backend-template/AsyncAPIdoc');
    const register = (prefix: string, folder: string) => {
      const manifestKey = prefix.replace('/', '');
      this.routes[`GET ${prefix}/*`] = (req: any, res: any) => {
        const rawPath = req.path || req.url || '';
        const normalizedPath = SailsJsServer.normalizeDocRequestPath(rawPath, prefix);
        const manifest = this.staticDocs[manifestKey] || this.loadStaticDocManifest(folder);
        const absolute = normalizedPath ? manifest.get(normalizedPath) : undefined;
        if (!absolute || !fs.existsSync(absolute)) {
          if (res.status) res.status(404);
          return res.send ? res.send('Not found') : undefined;
        }
        if (res.type) {
          if (absolute.endsWith('.html')) res.type('text/html');
          else if (absolute.endsWith('.js')) res.type('application/javascript');
          else if (absolute.endsWith('.css')) res.type('text/css');
          else if (absolute.endsWith('.json')) res.type('application/json');
        }
        const content = fs.readFileSync(absolute);
        return res.send ? res.send(content) : content;
      };
    };
    register('/OASdoc', 'apps/backend-template/OASdoc');
    register('/AsyncAPIdoc', 'apps/backend-template/AsyncAPIdoc');
    this.routes['GET /docs/asyncapi'] = (_req: any, res: any) => {
      if (res.redirect) return res.redirect('/AsyncAPIdoc');
      if (res.status && res.json) return res.status(302).json({ location: '/AsyncAPIdoc' });
      return undefined;
    };
  }

  /**
   * Writes through the native response, not Express 4's helpers (JUM-704).
   *
   * Sails runs Express 4 underneath, and this repository overrides `send` to
   * `^1.2.0` for Express 5. Express 4's `res.json` reaches into that package's
   * `mime.charsets`, which the new major no longer exposes, so every reply
   * answers 500. Same cause as the LoopBack adapter, same remedy: write the
   * status, the content type and the body directly.
   */
  // eslint-disable-next-line class-methods-use-this
  private createResponseAdapter(res: any): any {
    let statusCode = 200;

    const write = (payload: any, contentType: string) => {
      res.statusCode = statusCode;
      if (res.setHeader) res.setHeader('content-type', contentType);
      res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return payload;
    };

    const adapter = {
      status(code: number) {
        statusCode = code;
        return adapter;
      },
      json(payload: any) {
        return write(payload, 'application/json; charset=utf-8');
      },
      send(payload: any) {
        if (typeof payload === 'string') return write(payload, 'text/plain; charset=utf-8');
        return write(payload, 'application/json; charset=utf-8');
      }
    };

    return adapter;
  }

  public endPointRegister(handlerFactory: IbaseHandler): void {
    const routeKey = `${handlerFactory.method.toUpperCase()} ${handlerFactory.path}`;
    this.routes[routeKey] = async (req: any, res: any) => {
      /*
       * The per-request store every handler reads (JUM-704). Express, Restify,
       * Fastify and Lambda each establish it; this adapter did not, and it
       * serves the same handlers, so every request through it would answer 500
       * with an empty message once it served one at all.
       */
      const store = new Map();
      return RequestContext.run(store, () => {
        store.set('correlationId', createUuid());
        store.set('timeStart', +new Date());
        store.set('request', req);
        store.set('authorization', req.headers?.authorization || '');
        return handlerFactory.handler(req, this.createResponseAdapter(res));
      });
    };
  }

  /** The port is a parameter so a suite can bind an ephemeral one (JUM-704). */
  public async start(port: number = _HTTP_PORT_): Promise<void> {
    this.registerStaticDocsRoutes();
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { Sails } = require('sails');
    this.sails = new Sails();

    await new Promise<void>((resolve, reject) => {
      this.sails.lift(
        {
          hooks: { grunt: false },
          log: { level: 'error' },
          port,
          routes: this.routes
        },
        (error: any) => {
          if (error) {
            reject(error);
            return;
          }
          this.application = this.sails;
          resolve();
        }
      );
    });
  }

  public async stop(): Promise<void> {
    if (!this.sails) return;
    await new Promise<void>((resolve, reject) => {
      this.sails.lower((error: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public static compile(): HTTPBaseServer<any> {
    if (!sailsJsServer) {
      sailsJsServer = new SailsJsServer();
    }
    return sailsJsServer;
  }
}

export { SailsJsServer };
