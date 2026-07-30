import type { IbaseHandler } from '@src/interface/HTTP/ports/IbaseHandler';
import type { IHandlerFactory } from './IHandlerFactory';

export type EndPointFactory = (config: IHandlerFactory) => IbaseHandler;
