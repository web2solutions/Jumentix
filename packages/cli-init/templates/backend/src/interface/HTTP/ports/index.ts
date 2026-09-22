import { EHTTPFrameworks } from './EHTTPFrameworks';
import type { EndPointFactory } from './EndPointFactory';
import { HTTPBaseServer } from './HTTPBaseServer';
import type { IAPIFactory } from './IAPIFactory';
import type { IbaseHandler } from './IbaseHandler';
import type { IbaseHandlerFactory } from './IbaseHandlerFactory';
import type { IController } from './IController';
import type { IControllerFactory } from './IControllerFactory';
import type { IHandlerFactory } from './IHandlerFactory';
import type { IHTTPRequest } from './IHTTPRequest';
import type { IHTTPResponse } from './IHTTPResponse';
import type { IHTTPServer } from './IHTTPServer';

// Split by declaration kind. Everything imported above with `import type` is erased
// at runtime, so listing it in a value `export { … }` block leaves Bun's ESM loader
// resolving a binding that does not exist and the whole barrel fails to load.
//
// The repo-wide codemod missed this shape: it handled `export { … } from '…'` but not
// a *local* re-export block fed by separate import statements.
//
// `EHTTPFrameworks` is an enum and `HTTPBaseServer` an abstract class — real runtime
// values, which is why they stay in the value export.
export type {
  EndPointFactory,
  IAPIFactory,
  IbaseHandler,
  IbaseHandlerFactory,
  IController,
  IControllerFactory,
  IHandlerFactory,
  IHTTPRequest,
  IHTTPResponse,
  IHTTPServer
};

export {
  EHTTPFrameworks,
  HTTPBaseServer
};
