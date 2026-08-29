import type { APIGatewayProxyEvent } from 'aws-lambda';

import { Context } from '@src/infra/context/Context';
import { withLambdaContext } from '@src/modules/Users/interface/restapi/frameworks/aws/lambda/handlers/runtime';

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
});
