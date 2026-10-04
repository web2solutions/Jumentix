export interface IServiceResponse<T = any> {
  result?: T;
  error?: Error | Record<string, any>;
}

export interface IKeyValueStorageClient {
  connected: boolean;
  get(key: string): Promise<IServiceResponse>;
  del(key: string): Promise<IServiceResponse>;
  set(key: string, value: any): Promise<IServiceResponse>;
  connect(): Promise<IServiceResponse>;
  disconnect(): Promise<IServiceResponse>;
}
