/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable class-methods-use-this */
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

export type LoopBackRequest = IHTTPRequest;
export type LoopBackResponse = {
  status: (statusCode: number) => LoopBackResponse;
  json: (payload: any) => any;
  send?: (payload: any) => any;
} & IHTTPResponse;

let loopBackServer: HTTPBaseServer<any> | undefined;

class LoopBackServer extends HTTPBaseServer<any> {
  public readonly application: any;

  /**
   * Mounted on the application; see `endPointRegister` for why.
   *
   * Built from **LoopBack's own Express**, not the workspace's. LoopBack 4
   * bundles Express 4 and this repository runs Express 5; a v5 router mounted
   * inside a v4 application answers every request with a 500 from
   * `res.header (... reading 'charsets')`, because the two disagree about the
   * response prototype. Resolving Express through `@loopback/rest` is what keeps
   * the router and the app on one version (JUM-704).
   */
  public readonly router: any = LoopBackServer.loopbackExpress().Router();

  private mounted = false;

  private static loopbackExpress(): any {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require(require.resolve('express', { paths: [require.resolve('@loopback/rest')] }));
  }

  constructor() {
    super();
    // Lazy require keeps compilation independent from optional framework install.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { RestApplication } = require('@loopback/rest');
    this.application = new RestApplication({
      rest: { port: _HTTP_PORT_ }
    });
    if (this.application.static) {
      this.application.static('/OASdoc', 'apps/backend-template/OASdoc');
      this.application.static('/AsyncAPIdoc', 'apps/backend-template/AsyncAPIdoc');
    }
    // On the router, not on the application: `app.get(key)` is LoopBack's
    // context lookup, and calling it with a path binds nothing — it now throws
    // rather than silently registering a route that never existed (JUM-704).
    this.router.get('/docs/asyncapi', (_req: any, res: any) => {
      res.statusCode = 302;
      res.setHeader('location', '/AsyncAPIdoc');
      res.end();
    });
  }

  /**
   * Writes through the native response, not Express 4's helpers (JUM-704).
   *
   * This repository overrides `send` to `^1.2.0` for Express 5. LoopBack bundles
   * Express 4, whose `res.json` reaches into `send`'s `mime.charsets` — a shape
   * that version no longer has — so every reply through `res.json` here answers
   * `500 TypeError: undefined is not an object (evaluating 'mime.charsets')`.
   * A security override for one major silently broke the other's consumers.
   *
   * Writing the status, the content type and the body directly avoids the
   * broken helper without loosening the override. What the caller receives is
   * the same JSON.
   */
  // eslint-disable-next-line class-methods-use-this
  private createResponseAdapter(response: any): any {
    let statusCode = 200;

    const write = (payload: any, contentType: string) => {
      response.statusCode = statusCode;
      response.setHeader('content-type', contentType);
      response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
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

  /**
   * Routes, on an Express router LoopBack mounts (JUM-704).
   *
   * This used to call `this.application[method](path, handler)` inside a
   * `try` that swallowed everything. On a LoopBack 4 `RestApplication`,
   * `app.get` is the **context lookup** — `get(bindingKey)` — not a route
   * registration, so every endpoint was quietly bound as a context read and
   * **no route was ever served**. The swallowing catch is why it looked fine.
   *
   * `mountExpressRouter` is LoopBack's own supported seam for handlers that
   * need `req`/`res`, which these do.
   */
  public endPointRegister(handlerFactory: IbaseHandler): void {
    const method = handlerFactory.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    this.router[method](handlerFactory.path, (req: any, res: any) => {
      const store = new Map();
      RequestContext.run(store, () => {
        store.set('correlationId', createUuid());
        store.set('timeStart', +new Date());
        store.set('request', req);
        store.set('authorization', req.headers?.authorization || '');
        return Promise.resolve(handlerFactory.handler(req, this.createResponseAdapter(res)))
          .catch(() => {
            if (!res.headersSent) res.status(500).json({ message: '' });
          });
      });
    });
  }

  public async start(): Promise<void> {
    this.mountRouter();
    await this.application.start();
  }

  /** Idempotent: `start` and a test driving the handler both need it mounted. */
  public mountRouter(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.application.mountExpressRouter('/', this.router);
  }

  public async stop(): Promise<void> {
    if (this.application?.stop) {
      await this.application.stop();
    }
  }

  public static compile(): HTTPBaseServer<any> {
    if (!loopBackServer) {
      loopBackServer = new LoopBackServer();
    }
    return loopBackServer;
  }
}

export { LoopBackServer };
