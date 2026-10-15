import type { IRepositoryConnectionOptions } from '@jumentix/external-persistence-core';
import { BaseExternalDataRepository } from '@jumentix/external-persistence-core';

export class DynamoDbRepository extends BaseExternalDataRepository {
  private client: any | null = null;

  constructor(options: IRepositoryConnectionOptions) {
    super({
      ...options,
      provider: 'aws-dynamodb'
    });
  }

  public async connect(): Promise<void> {
    const dynamoModule = await this.loadModule('@aws-sdk/client-dynamodb');
    const DynamoDBClient = (
      dynamoModule.DynamoDBClient || dynamoModule.default?.DynamoDBClient
    );

    if (!DynamoDBClient) {
      throw new Error('Unable to resolve DynamoDBClient from "@aws-sdk/client-dynamodb".');
    }

    const healthCheckOnConnect = this.getExtraOption<boolean>('healthCheckOnConnect', false);
    const credentials = this.getExtraOption<
      { accessKeyId: string; secretAccessKey: string } | undefined
    >('credentials', undefined);
    // Health probes must fail closed quickly: the default AWS credential
    // provider chain (notably IMDS) can hang for minutes in CI Docker when
    // nothing answers, which turns a unit assertion into a branch-gate flake.
    const clientConfig: Record<string, unknown> = {
      region: this.options.region || this.getExtraOption<string>('region', 'us-east-1'),
      endpoint: this.options.endpoint
        || this.getExtraOption<string | undefined>('endpoint', undefined),
      ...(credentials ? { credentials } : {}),
      ...(healthCheckOnConnect ? { maxAttempts: 1 } : {})
    };

    this.client = new DynamoDBClient(clientConfig);

    if (healthCheckOnConnect) {
      const ListTablesCommand = (
        dynamoModule.ListTablesCommand || dynamoModule.default?.ListTablesCommand
      );
      if (ListTablesCommand && typeof this.client.send === 'function') {
        await this.client.send(new ListTablesCommand({ Limit: 1 }));
      }
    }

    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    if (this.client && typeof this.client.destroy === 'function') {
      this.client.destroy();
    }
    this.client = null;
    this.connected = false;
  }

  public getClient(): any | null {
    return this.client;
  }
}
