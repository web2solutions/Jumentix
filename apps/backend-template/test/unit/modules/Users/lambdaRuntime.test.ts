import type { APIGatewayProxyEvent } from 'aws-lambda';

import { Context } from '@src/infra/context/Context';
import {
  getSchemaOAS,
  withLambdaContext
} from '@src/modules/Users/interface/restapi/frameworks/aws/lambda/handlers/runtime';

const lambdaEvent = (headers: Record<string, string> = {}): APIGatewayProxyEvent => ({
  body: '',
  headers,
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/users',
  pathParameters: {},
  queryStringParameters: {}
} as unknown as APIGatewayProxyEvent);

describe('users Lambda runtime context', () => {
  it('binds request metadata and generated correlation id for the handler', async () => {
    expect.hasAssertions();

    const event = lambdaEvent({ Authorization: 'Bearer test-token' });

    const result = await withLambdaContext(event, async () => {
      const store = Context.getStore() as Map<string, unknown>;

      return {
        authorization: store.get('authorization'),
        correlationId: store.get('correlationId'),
        request: store.get('request'),
        timeStart: store.get('timeStart')
      };
    });

    expect(result.authorization).toBe('Bearer test-token');
    expect(result.request).toStrictEqual(event);
    expect(result.correlationId).toStrictEqual(expect.any(String));
    expect(result.timeStart).toStrictEqual(expect.any(Number));
  });

  it('rejects with the runner failure while still using the Lambda context', async () => {
    expect.hasAssertions();

    await expect(withLambdaContext(lambdaEvent(), async () => {
      const store = Context.getStore() as Map<string, unknown>;
      expect(store.get('authorization')).toBe('Bearer');
      throw new Error('lambda runtime failed');
    })).rejects.toThrow('lambda runtime failed');
  });

  it('prefers the lowercase authorization header when both casings arrive', async () => {
    expect.hasAssertions();

    const authorization = await withLambdaContext(
      lambdaEvent({ authorization: 'Bearer lowercase', Authorization: 'Bearer upper' }),
      async () => (Context.getStore() as Map<string, unknown>).get('authorization')
    );

    expect(authorization).toBe('Bearer lowercase');
  });

  it('falls back to a bare Bearer prefix when the event carries no headers', async () => {
    expect.hasAssertions();

    const event = lambdaEvent();
    delete (event as { headers?: Record<string, string> }).headers;

    const authorization = await withLambdaContext(event, async () => (
      (Context.getStore() as Map<string, unknown>).get('authorization')
    ));

    expect(authorization).toBe('Bearer');
  });
});

describe('users Lambda OAS lookup', () => {
  it('resolves the operation config declared for the event path and method', () => {
    expect.hasAssertions();

    const config = getSchemaOAS(lambdaEvent());

    expect(config.operationId).toBe('getAll');
  });

  it('answers an empty config for an undeclared path or method', () => {
    expect.hasAssertions();

    // A miss is "no validation schema", not a crash — the handler still runs.
    expect(getSchemaOAS({ ...lambdaEvent(), path: '/no-such-path' })).toStrictEqual({});
    expect(getSchemaOAS({ ...lambdaEvent(), httpMethod: 'PATCH' })).toStrictEqual({});
  });
});
