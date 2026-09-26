import type { ClientContext, CognitoIdentity, Context } from 'aws-lambda';

const composeContext = (): Context =>
  ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    identity: {} as CognitoIdentity,
    clientContext: {} as ClientContext
  }) as Context;

export default composeContext;
