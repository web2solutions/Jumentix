import type { IHTTPServer } from './IHTTPServer';
import type { IbaseHandler } from './IbaseHandler';

export abstract class HTTPBaseServer<T> implements IHTTPServer<T> {
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  // constructor() { }

  /**
   * Register one endpoint, failing loudly when the framework refuses it.
   *
   * This used to swallow every error from the framework's own registration
   * call. A route that failed to register simply did not exist, and every
   * request to it came back as the framework's 404 — no log at boot, no failed
   * assertion until some test asked for that route and got a 404 where it
   * expected a 403, a 400 or a 200. That is the shape JUM-687 recorded three
   * times from CI and never explained: "a request that did not reach the
   * handler the test was aiming at", with no domain error raised anywhere.
   *
   * Registration is boot-time work with no user waiting on it, so the only
   * useful behaviour is to stop: an API that silently serves fewer routes than
   * its specification declares is worse than one that refuses to start
   * (Requirement 065).
   */
  public endPointRegister(handlerFactory: IbaseHandler): void {
    try {
      (this.application as any)[handlerFactory.method](
        handlerFactory.path,
        handlerFactory.handler
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Endpoint registration failed for ${String(handlerFactory.method).toUpperCase()} `
          + `${handlerFactory.path}: ${reason}`
      );
    }
  }

  public abstract application: T;

  public abstract start(): Promise<void>;

  public abstract stop(): Promise<void>;

  public static compile() {}
}
