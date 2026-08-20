export type LocaleText = { en: string; 'pt-BR': string };

export type DocsSnippet = {
  id: string;
  title: LocaleText;
  description: LocaleText;
  code: string;
};

export type DocsRuntimeId =
  | 'cana'
  | 'designer-core'
  | 'jumentix-browser-lab'
  | 'key-value-storage'
  | 'message-mediator'
  | 'mutex-service'
  | 'sdk-rest-client'
  | 'sdk-websocket-client';

export type RuntimeApiBag = Record<string, unknown>;

export type DocsRuntime = {
  id: DocsRuntimeId;
  /** Global name injected into snippet scope (e.g. `cana`, `api`). */
  apiGlobalName: string;
  /** Extra globals: { dbName: string } etc. */
  load: (sessionKey: string) => Promise<{
    api: RuntimeApiBag;
    extras?: Record<string, unknown>;
    reset?: () => Promise<void>;
  }>;
};
