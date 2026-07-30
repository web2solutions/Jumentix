import type { IHTTPRequest } from './IHTTPRequest';
import type { IHTTPResponse } from './IHTTPResponse';

export interface IbaseHandler {
    method: string;
    path: string;
    handler(req: IHTTPRequest, res: IHTTPResponse): void | Promise<any>;
    securitySchemes?(req: IHTTPRequest, res: IHTTPResponse, next: any): void;
}
