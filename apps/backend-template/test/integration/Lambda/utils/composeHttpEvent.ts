import type { APIGatewayProxyEvent } from 'aws-lambda';

const composeHttpEvent = ({
  body,
  headers,
  method,
  path
}: {
  body?: any;
  headers?: Record<any, any>;
  method?: string;
  path?: string;
}): APIGatewayProxyEvent => {
  const event = {
    body: body ? JSON.stringify(body) : '',
    headers: headers ?? {},
    httpMethod: method ?? 'GET',
    path: path ?? '',
    isBase64Encoded: false,
    pathParameters: {},
    queryStringParameters: {}
  } as unknown as APIGatewayProxyEvent;
  return event;
};

export default composeHttpEvent;
