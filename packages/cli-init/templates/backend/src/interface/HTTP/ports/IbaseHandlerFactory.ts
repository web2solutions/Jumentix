import type { IHTTPRequest } from './IHTTPRequest';
import type { IHTTPResponse } from './IHTTPResponse';

export interface IbaseHandlerFactory {
    method: string;
    path: string;
    handler(req: IHTTPRequest, res: IHTTPResponse): void;
}
