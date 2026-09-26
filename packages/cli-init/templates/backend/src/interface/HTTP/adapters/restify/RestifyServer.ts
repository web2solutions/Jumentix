import path from 'node:path';

import bunyan from 'bunyan';
import restify from 'restify';

import { HTTP_PORT } from '@src/config/constants';
import { Context } from '@src/infra/context/Context';
import HTTPBaseServer from '@src/interface/HTTP/ports/HTTPBaseServer';
import { createUuid } from '@src/modules/port/UUID';

import type { BaseError } from '@src/infra/exceptions';
import type { IbaseHandler } from '@src/interface/HTTP/ports/IbaseHandler';

type Restify = restify.Server;

let restifyServer: any;
class RestifyServer extends HTTPBaseServer<Restify> {
  public readonly application: Restify;

  constructor() {
    super();
    this.application = restify.createServer({
      log: bunyan.createLogger({
        name: 'api',
        streams: [
          {
            stream: process.stdout,
            level: bunyan.FATAL + 1
          }
        ]
      })
    });
    // this.application.use(cors());
    // this.application.use(helmet());
    this.application.use(restify.plugins.gzipResponse());
    this.application.use(restify.plugins.queryParser());
    this.application.use(restify.plugins.urlEncodedBodyParser());
    this.application.use(restify.plugins.dateParser());
    this.application.use((req, res, next) => {
      const store = new Map();
      Context.run(store, () => {
        store.set('correlationId', createUuid());
        store.set('timeStart', +new Date());
        store.set('request', req);
        store.set('authorization', req.headers.authorization || '');

        // requestLogger('request started');
        next();
      });
    });
    // this.application.use(bodyParser.json({ limit: '100mb' }));
    // this.application.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
    this.createDocEndPoint();
  }

  public endPointRegister(handlerFactory: IbaseHandler): void {
    const { method, handler } = handlerFactory;
    let verb = method;
    try {
      /* if (handlerFactory.securitySchemes) {
        (this.application as any)[method](
          handlerFactory.path,
          handlerFactory.securitySchemes,
          handler
        );
        return;
      } */
      if (verb === 'delete') {
        verb = 'del';
      }
      (this.application as any)[verb](handlerFactory.path, handler);
    } catch (error) {
      // console.log(error);
    }
  }

  private createDocEndPoint() {
    this.application.get(
      '/OASdoc/*',
      restify.plugins.serveStatic({
        directory: path.resolve(process.cwd(), 'apps/backend-template/OASdoc'),
        default: 'index.html'
      })
    );
    this.application.get(
      '/AsyncAPIdoc/*',
      restify.plugins.serveStatic({
        directory: path.resolve(process.cwd(), 'apps/backend-template/AsyncAPIdoc'),
        default: 'index.html'
      })
    );
    this.application.get('/docs/asyncapi', (_req, res, next) =>
      res.redirect(302, '/AsyncAPIdoc', next)
    );
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.application.listen(HTTP_PORT, () => {
          // eslint-disable-next-line no-console
          console.log(`Restify App Listening on Port ${HTTP_PORT}`);
          resolve();
        });
      } catch (error) {
        // console.error(`An error occurred: ${JSON.stringify(error)}`);
        // Best-effort cleanup before rejecting; the executor cannot await.
        // A stop failure stays an unhandled rejection, as before.
        this.stop().catch((stopError: unknown) => {
          throw stopError;
        });
        reject(new Error((error as BaseError).message));
      }
    });
  }

  public async stop(): Promise<void> {
    await Promise.resolve(this.application.close());
    // process.exit(0);
  }

  public static compile(): HTTPBaseServer<Restify> {
    if (!restifyServer) {
      restifyServer = new RestifyServer();
    }
    return restifyServer;
  }
}

export default RestifyServer;
