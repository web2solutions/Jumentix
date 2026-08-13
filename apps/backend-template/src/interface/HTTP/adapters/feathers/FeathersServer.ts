/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable class-methods-use-this */
import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';
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

export type FeathersRequest = IHTTPRequest;
export type FeathersResponse = {
  status: (statusCode: number) => FeathersResponse;
  json: (payload: any) => any;
  send?: (payload: any) => any;
} & IHTTPResponse;

let feathersServer: HTTPBaseServer<any> | undefined;

type RegisteredRoute = {
  method: string;
  path: string;
  handler: IbaseHandler['handler'];
};

class FeathersServer extends HTTPBaseServer<any> {
  public readonly application: any;

  private httpServer: any;

  /**
   * Routes this adapter serves (JUM-704).
   *
   * `endPointRegister` used to call `this.application[method](path, handler)`.
   * A Koa/Feathers application has no such method — the call threw
   * `this.application[method] is undefined` on the first endpoint, which means
   * **this adapter has never registered a route**. Nothing reported it: the
   * suite named after it called an Express handler directly, and the framework
   * was not installed, so no build ever loaded this file.
   *
   * Matching here rather than adding a router dependency keeps the shape the
   * Vercel adapter already uses in this repository.
   */
  private readonly routes: RegisteredRoute[] = [];

  constructor() {
    super();
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { feathers } = require('@feathersjs/feathers');
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const {
      koa,
      rest,
      bodyParser,
      errorHandler
    } = require('@feathersjs/koa');

    this.application = koa(feathers());

    /*
     * The per-request store every handler reads (JUM-704).
     *
     * Express, Restify, Fastify and Lambda each establish it; this adapter did
     * not, and it serves the same handlers — `localhost.get` reads
     * `correlationId` from the store, so every request through it answered 500
     * with an empty message. JUM-698 found and fixed the same defect in the four
     * adapters that could be started at the time; this one could not be, because
     * its framework was not installed.
     *
     * First in the chain on purpose: everything downstream runs inside the
     * store, including the static-doc branch and the route handlers.
     */
    this.application.use(async (context: any, next: any) => {
      const store = new Map();
      return RequestContext.run(store, () => {
        store.set('correlationId', v4());
        store.set('timeStart', +new Date());
        store.set('request', context.request);
        store.set('authorization', context.request?.headers?.authorization || '');
        return next();
      });
    });

    this.application.use(async (context: any, next: any) => {
      const requestPath = context.path || context.request?.path || '';
      const rootDir = process.cwd();
      const readStatic = (prefix: string, folder: string): boolean => {
        if (!requestPath.startsWith(prefix)) return false;
        const relative = requestPath.replace(`${prefix}/`, '') || 'index.html';
        const absolute = path.join(rootDir, folder, relative);
        if (!fs.existsSync(absolute)) {
          context.status = 404;
          context.body = { message: 'Not found' };
          return true;
        }
        context.status = 200;
        context.body = fs.readFileSync(absolute);
        if (absolute.endsWith('.html')) context.type = 'text/html';
        else if (absolute.endsWith('.js')) context.type = 'application/javascript';
        else if (absolute.endsWith('.css')) context.type = 'text/css';
        else if (absolute.endsWith('.json')) context.type = 'application/json';
        return true;
      };
      if (requestPath === '/docs/asyncapi') {
        context.status = 302;
        context.redirect('/AsyncAPIdoc');
        return;
      }
      if (readStatic('/OASdoc', 'apps/backend-template/OASdoc')) return;
      if (readStatic('/AsyncAPIdoc', 'apps/backend-template/AsyncAPIdoc')) return;
      await next();
    });
    this.application.use(bodyParser());
    this.application.configure(rest());
    // After the body parser, before the error handler: the routes need a parsed
    // body, and a handler that throws should reach `errorHandler` (JUM-704).
    this.registerRouter();
    this.application.use(errorHandler());
  }

  private createResponseAdapter(context: any): any {
    return {
      status(code: number) {
        context.status = code;
        return this;
      },
      json(payload: any) {
        context.body = payload;
        return payload;
      },
      send(payload: any) {
        context.body = payload;
        return payload;
      }
    };
  }

  public endPointRegister(handlerFactory: IbaseHandler): void {
    this.routes.push({
      method: handlerFactory.method.toUpperCase(),
      path: handlerFactory.path,
      handler: handlerFactory.handler
    });
  }

  /** `/users/:id` against `/users/7`, returning the parameters it bound. */
  private static matchPath(template: string, value: string): { matched: boolean; params: any } {
    const templateParts = template.split('/').filter(Boolean);
    const valueParts = value.split('/').filter(Boolean);
    if (templateParts.length !== valueParts.length) return { matched: false, params: {} };

    const params: Record<string, string> = {};
    for (let index = 0; index < templateParts.length; index += 1) {
      const templatePart = templateParts[index];
      const valuePart = valueParts[index];
      if (templatePart.startsWith(':')) {
        params[templatePart.slice(1)] = decodeURIComponent(valuePart);
      } else if (templatePart !== valuePart) {
        return { matched: false, params: {} };
      }
    }
    return { matched: true, params };
  }

  private registerRouter(): void {
    this.application.use(async (context: any, next: any) => {
      const method = String(context.method || 'GET').toUpperCase();
      const pathname = context.path || context.request?.path || '/';
      const matched = this.routes
        .map((route) => ({ route, match: FeathersServer.matchPath(route.path, pathname) }))
        .find((candidate) => candidate.route.method === method && candidate.match.matched);

      if (!matched) {
        await next();
        return;
      }

      const req = {
        ...context.request,
        body: context.request?.body,
        params: matched.match.params,
        query: context.request?.query || {},
        headers: context.request?.headers || {}
      };
      const res = this.createResponseAdapter(context);
      const result = await matched.route.handler(req as any, res as any);
      if (result !== undefined && context.body === undefined) {
        context.body = result;
      }
    });
  }

  public async start(): Promise<void> {
    this.httpServer = await this.application.listen(_HTTP_PORT_);
  }

  public async stop(): Promise<void> {
    if (this.httpServer?.close) {
      await Promise.resolve(this.httpServer.close());
    }
  }

  public static compile(): HTTPBaseServer<any> {
    if (!feathersServer) {
      feathersServer = new FeathersServer();
    }
    return feathersServer;
  }
}

export { FeathersServer };
