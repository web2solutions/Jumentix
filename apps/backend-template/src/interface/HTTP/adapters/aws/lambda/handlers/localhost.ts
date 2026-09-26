import type { APIGatewayProxyResult, Handler } from 'aws-lambda';

export const handler: Handler = async (): Promise<APIGatewayProxyResult> =>
  // console.log(event);
  ({
    statusCode: 200,
    body: JSON.stringify({ status: 'result' })
  });

export const getHandler = handler;
