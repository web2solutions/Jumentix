import {
  resolveHTTPFramework,
  isRealtimeApiEnabled,
  resolveRealtimeApiProtocol,
  shouldStartRealtimeApi
} from '@src/interface/runtime/RuntimeEnvironment';

describe('runtime environment', () => {
  it('uses express as default framework', () => {
    expect.assertions(1);
    expect(resolveHTTPFramework({} as unknown as NodeJS.ProcessEnv)).toBe('express');
  });

  it('falls back from whitespace-only JUMENTIX_ values to legacy AAA_', () => {
    expect.assertions(1);
    expect(resolveHTTPFramework({
      JUMENTIX_HTTP_FRAMEWORK: '   ',
      AAA_HTTP_FRAMEWORK: 'fastify'
    } as unknown as NodeJS.ProcessEnv)).toBe('fastify');
  });

  it('normalizes framework and protocol values from env strings', () => {
    expect.assertions(2);
    expect(resolveHTTPFramework({ JUMENTIX_HTTP_FRAMEWORK: ' EXPRESS ' } as unknown as NodeJS.ProcessEnv)).toBe('express');
    expect(resolveRealtimeApiProtocol({
      JUMENTIX_REALTIME_API_PROTOCOL: ' GRPC '
    } as unknown as NodeJS.ProcessEnv)).toBe('grpc');
  });

  it('supports non-express frameworks and throws for unknown framework', () => {
    expect.assertions(1);
    expect(() => resolveHTTPFramework({ JUMENTIX_HTTP_FRAMEWORK: 'unknown-http' } as unknown as NodeJS.ProcessEnv))
      .toThrow('Unsupported JUMENTIX_HTTP_FRAMEWORK');
  });

  it('resolves realtime enablement from env', () => {
    expect.assertions(3);
    expect(isRealtimeApiEnabled({ JUMENTIX_REALTIME_API: 'yes' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isRealtimeApiEnabled({ JUMENTIX_REALTIME_API: 'no' } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isRealtimeApiEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('resolves realtime protocol with websocket default', () => {
    expect.assertions(2);
    expect(resolveRealtimeApiProtocol({} as unknown as NodeJS.ProcessEnv)).toBe('websocket');
    expect(resolveRealtimeApiProtocol({ JUMENTIX_REALTIME_API_PROTOCOL: 'grpc' } as unknown as NodeJS.ProcessEnv)).toBe('grpc');
  });

  it('throws for unsupported realtime protocol', () => {
    expect.assertions(1);
    expect(() => resolveRealtimeApiProtocol({ JUMENTIX_REALTIME_API_PROTOCOL: 'mqtt' } as unknown as NodeJS.ProcessEnv))
      .toThrow('Unsupported JUMENTIX_REALTIME_API_PROTOCOL');
  });

  it('checks protocol-specific startup gate', () => {
    expect.assertions(3);
    expect(shouldStartRealtimeApi('websocket', {
      JUMENTIX_REALTIME_API: 'yes',
      JUMENTIX_REALTIME_API_PROTOCOL: 'websocket'
    } as unknown as NodeJS.ProcessEnv)).toBe(true);

    expect(shouldStartRealtimeApi('grpc', {
      JUMENTIX_REALTIME_API: 'yes',
      JUMENTIX_REALTIME_API_PROTOCOL: 'websocket'
    } as unknown as NodeJS.ProcessEnv)).toBe(false);

    expect(shouldStartRealtimeApi('grpc', {
      JUMENTIX_REALTIME_API: 'no',
      JUMENTIX_REALTIME_API_PROTOCOL: 'grpc'
    } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('uses process env defaults when env argument is omitted', () => {
    expect.hasAssertions();
    const originalEnv = { ...process.env };
    process.env.JUMENTIX_HTTP_FRAMEWORK = 'express';
    process.env.JUMENTIX_REALTIME_API = 'yes';
    process.env.JUMENTIX_REALTIME_API_PROTOCOL = 'grpc';
    expect(resolveHTTPFramework()).toBe('express');
    expect(isRealtimeApiEnabled()).toBe(true);
    expect(resolveRealtimeApiProtocol()).toBe('grpc');
    expect(shouldStartRealtimeApi('grpc')).toBe(true);
    process.env = originalEnv;
  });
});
