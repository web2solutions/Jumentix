import type { IServiceResponse } from './contracts';

class ServiceResponse<T = any> implements IServiceResponse<T> {
  public result?: T;

  public error?: Error | Record<string, any>;

  public constructor(payload: IServiceResponse<T>) {
    this.result = payload.result;
    this.error = payload.error;
  }
}

export default ServiceResponse;
