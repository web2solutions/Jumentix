import type { CanaChangeEvent, CanaClient } from '@jumentix/cana';

export type CanaReduxDispatch<TAction> = (action: TAction) => unknown;

export type CanaReduxBridge = {
  stop: () => void;
  getLastCursor: () => number;
};

export type ConnectCanaToReduxOptions<TAction> = {
  client: CanaClient;
  dispatch: CanaReduxDispatch<TAction>;
  mapEvent: (event: CanaChangeEvent) => TAction | readonly TAction[] | undefined;
  sinceCursor?: number;
  onError?: (error: unknown) => void;
};

export function connectCanaToRedux<TAction>(
  options: ConnectCanaToReduxOptions<TAction>
): CanaReduxBridge {
  let lastCursor = options.sinceCursor ?? 0;
  let stop = () => {};

  try {
    stop = options.client.subscribe((event) => {
      const mapped = options.mapEvent(event);
      if (Array.isArray(mapped)) {
        for (const action of mapped as readonly TAction[]) {
          options.dispatch(action);
        }
      } else if (mapped !== undefined) {
        options.dispatch(mapped as TAction);
      }
      lastCursor = event.cursor;
    }, options.sinceCursor === undefined ? undefined : { sinceCursor: options.sinceCursor });
  } catch (error) {
    options.onError?.(error);
    throw error;
  }

  return {
    stop,
    getLastCursor: () => lastCursor
  };
}
