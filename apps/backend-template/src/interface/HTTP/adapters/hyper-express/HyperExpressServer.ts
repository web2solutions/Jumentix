import HyperExpress from 'hyper-express';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { _HTTP_PORT_ } from '@src/config/constants';
import { IbaseHandler, HTTPBaseServer } from '@src/interface/HTTP/ports';
import { Context } from '@src/infra/context/Context';
import { v4 } from 'uuid';

let hyperExpressServer: any;
class HyperExpressServer extends HTTPBaseServer<HyperExpress.Server> {
  public readonly application: HyperExpress.Server;

  private staticDocs: Record<string, Map<string, string>>;

  constructor() {
    super();
    this.application = new HyperExpress.Server();
    this.staticDocs = {
      OASdoc: HyperExpressServer.loadStaticDocManifest('apps/backend-template/OASdoc'),
      AsyncAPIdoc: HyperExpressServer.loadStaticDocManifest('apps/backend-template/AsyncAPIdoc')
    };
    // this.application.use(cors());
    // this.application.use('/*', helmet());
    // https://github.com/kartikk221/hyper-express-body-parser
    this.application.use((req, res, next) => {
      const store = new Map();
      Context.run(store, () => {
        store.set('correlationId', v4());
        store.set('timeStart', +new Date());
        store.set('request', req);
        store.set('authorization', req.headers.authorization || '');

        // requestLogger('request started');
        next();
      });
    });
    this.createDocEndPoint();
  }

  public endPointRegister(handlerFactory: IbaseHandler): void {
    try {
      (this.application as any)[handlerFactory.method](
        handlerFactory.path,
        handlerFactory.handler
      );
    } catch (error) {
      // console.log(error);
    }
  }

  private createDocEndPoint() {
    this.application.get('/OASdoc/*', (request: HyperExpress.Request, response: HyperExpress.Response) => {
      try {
        const relativePath = HyperExpressServer.normalizeDocRequestPath(request.path, '/OASdoc');
        const absolutePath = relativePath ? this.staticDocs.OASdoc.get(relativePath) : undefined;
        if (!absolutePath || !fs.existsSync(absolutePath)) {
          return response.status(404).json({ message: 'file not found' });
        }
        return response
          .header('content-type', HyperExpressServer.getContentType(absolutePath))
          .send(fs.readFileSync(absolutePath));
      } catch (error: any) {
        return response.status(500).json({ message: error.message, error });
      }
    });
    this.application.get('/AsyncAPIdoc/*', (request: HyperExpress.Request, response: HyperExpress.Response) => {
      try {
        const relativePath = HyperExpressServer.normalizeDocRequestPath(request.path, '/AsyncAPIdoc');
        const absolutePath = relativePath
          ? this.staticDocs.AsyncAPIdoc.get(relativePath)
          : undefined;
        if (!absolutePath || !fs.existsSync(absolutePath)) {
          return response.status(404).json({ message: 'file not found' });
        }
        return response
          .header('content-type', HyperExpressServer.getContentType(absolutePath))
          .send(fs.readFileSync(absolutePath));
      } catch (error: any) {
        return response.status(500).json({ message: error.message, error });
      }
    });
    this.application.get('/docs/asyncapi', (_request: HyperExpress.Request, response: HyperExpress.Response) => {
      response.redirect('/AsyncAPIdoc');
    });
  }

  private static normalizeDocRequestPath(rawPath: string, prefix: string): string {
    const pathname = String(rawPath || '').split('?')[0];
    const trimmed = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
    const candidate = trimmed.replace(/^\/+/, '') || 'index.html';
    const normalized = path.posix.normalize(`/${candidate}`).replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return '';
    return normalized;
  }

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

  private static loadStaticDocManifest(docFolder: string): Map<string, string> {
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

  public async start(): Promise<void> {
    try {
      await this.application.listen(_HTTP_PORT_);
      // eslint-disable-next-line no-console
      console.log(`HyperExpress App Listening on Port ${_HTTP_PORT_}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`An error occurred: ${JSON.stringify(error)}`);
      this.stop();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public async stop(): Promise<void> {
    await Promise.resolve(this.application.close());
  }

  public static compile(): HTTPBaseServer<HyperExpress.Server> {
    if (!hyperExpressServer) {
      hyperExpressServer = new HyperExpressServer();
    }
    return hyperExpressServer;
  }
}

export { HyperExpressServer };
