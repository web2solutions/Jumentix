/* eslint-disable no-underscore-dangle */
import type {
  IOpenApiDataEntityLike,
  IOpenApiFieldDefinitionLike
} from '@src/shared/openapi/OpenApi31DataEntity';
import {
  throwIfDataEntityPayloadIsNotOpenApi31Compliant,
  throwIfDataEntityIsNotOpenApi31Compliant,
  throwIfFieldDefinitionIsNotOpenApi31Compliant
} from '@src/shared/openapi/OpenApi31DataEntity';
import { DomainValidationError } from '@src/infra/exceptions';
import { UUID } from './UUID';

export abstract class BaseModel<T> {
  private readonly _createdAt: Date;

  private _updatedAt: Date;

  private readonly _id: string;

  public _excludeOnSerialize: string[] = [];

  protected _deletedAt: string | null;

  constructor(meta?: {
    id?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    deletedAt?: Date | string | null;
  }) {
    this._id = meta?.id ? UUID.parse(meta.id).toString() : UUID.create().toString();
    const now = new Date();
    this._createdAt = meta?.createdAt ? new Date(meta.createdAt) : now;
    this._updatedAt = meta?.updatedAt ? new Date(meta.updatedAt) : this._createdAt;
    if (meta?.deletedAt === undefined || meta.deletedAt === null) {
      this._deletedAt = null;
    } else if (meta.deletedAt instanceof Date) {
      this._deletedAt = meta.deletedAt.toISOString();
    } else {
      this._deletedAt = String(meta.deletedAt);
    }
  }

  public get id(): string {
    return this._id;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public set updatedAt(_updatedAt: Date) {
    this._updatedAt = _updatedAt;
  }

  public get deletedAt(): string | null {
    return this._deletedAt;
  }

  public set deletedAt(value: Date | string | null) {
    if (value === undefined || value === null || value === '') {
      this._deletedAt = value === '' ? '' : null;
      return;
    }
    this._deletedAt = value instanceof Date ? value.toISOString() : String(value);
  }

  public static throwIfFieldSchemaIsNotOpenApi31Compliant(
    field: IOpenApiFieldDefinitionLike
  ): void {
    throwIfFieldDefinitionIsNotOpenApi31Compliant(field);
  }

  public static throwIfDataEntitySchemaIsNotOpenApi31Compliant(
    entity: IOpenApiDataEntityLike
  ): void {
    throwIfDataEntityIsNotOpenApi31Compliant(entity);
  }

  public static throwIfModelPayloadIsNotOpenApi31Compliant(
    payload: Record<string, any>,
    entity: IOpenApiDataEntityLike
  ): void {
    try {
      throwIfDataEntityPayloadIsNotOpenApi31Compliant(payload, entity);
    } catch (error) {
      throw new DomainValidationError((error as Error).message);
    }
  }

  public serialize(): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;
    const protoObj = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this));
    const protoKeys = Object.keys(protoObj);
    const api: any = {};
    for (const property of protoKeys) {
      // eslint-disable-next-line no-continue
      if (property === 'constructor') continue;
      // eslint-disable-next-line no-continue
      if (property === 'serialize') continue;
      // eslint-disable-next-line no-continue
      if (this._excludeOnSerialize.indexOf(property) > -1) continue;
      api[property] = self[property];
    }

    return Object.freeze({
      id: this.id,
      ...api,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt
    });
  }
}
