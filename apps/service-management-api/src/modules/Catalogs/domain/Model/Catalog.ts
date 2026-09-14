/* eslint-disable no-underscore-dangle */
import {
  BaseModel
} from '@src/modules/port';
import {
  canNotBeEmpty
} from '@src/shared/validators';
import type {
  ICatalog
} from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type {
  RequestCreateCatalog
} from '@service-management-api/modules/Catalogs/interface/dto/RequestCreateCatalog';

interface CatalogFactory extends RequestCreateCatalog {
  id?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

/**
 * Catalog — the shared-catalog aggregate (JUM-491). One instance is one
 * shared domain design plus its concurrency metadata; see `ICatalog` for the
 * concurrency and tombstone semantics.
 */
export class Catalog extends BaseModel<ICatalog> implements ICatalog {
  private _organization: string = '';

  private _name: string = '';

  private _description: string = '';

  private _version: number = 1;

  private _design: Record<string, any> = {};

  private _provenance: Record<string, any> | undefined;

  private _createdBy: string = '';

  private _updatedBy: string = '';

  constructor(payload: CatalogFactory) {
    super({
      id: payload.id,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      deletedAt: payload.deletedAt ?? ''
    });
    canNotBeEmpty('name', payload.name);
    canNotBeEmpty('organization', payload.organization);
    this._organization = payload.organization ?? '';
    this._name = payload.name;
    this._description = payload.description ?? '';
    this._version = payload.version ?? 1;
    this._design = payload.design ?? {};
    this._provenance = payload.provenance;
    this._createdBy = payload.createdBy ?? '';
    this._updatedBy = payload.updatedBy ?? '';
    this._excludeOnSerialize = [
      'deleted',
      'bumpVersion',
      'tombstone',
      'restore'
    ];
  }

  public get organization(): string {
    return this._organization;
  }

  public get name(): string {
    return this._name;
  }

  public set name(name: string) {
    canNotBeEmpty('name', name);
    this._name = name;
  }

  public get description(): string {
    return this._description;
  }

  public set description(description: string) {
    this._description = description ?? '';
  }

  public get version(): number {
    return this._version;
  }

  public get design(): Record<string, any> {
    return this._design;
  }

  public set design(design: Record<string, any>) {
    this._design = design ?? {};
  }

  public get provenance(): Record<string, any> | undefined {
    return this._provenance;
  }

  public set provenance(provenance: Record<string, any> | undefined) {
    this._provenance = provenance;
  }

  public get createdBy(): string {
    return this._createdBy;
  }

  public get updatedBy(): string {
    return this._updatedBy;
  }

  public set updatedBy(updatedBy: string) {
    this._updatedBy = updatedBy ?? '';
  }

  public get deletedAt(): string {
    return this._deletedAt ?? '';
  }

  public get deleted(): boolean {
    return this._deletedAt !== '' && this._deletedAt != null;
  }

  /** Bump the concurrency token and stamp the mutation time/actor. */
  public bumpVersion(actor: string = ''): void {
    this._version += 1;
    this.updatedAt = new Date();
    this._updatedBy = actor;
  }

  /** Soft-delete: the record stays so the deletion can propagate/recover. */
  public tombstone(actor: string = ''): void {
    this._deletedAt = new Date().toISOString();
    this.bumpVersion(actor);
  }

  /** Recover a tombstoned record; a restore is a write, so the version bumps. */
  public restore(actor: string = ''): void {
    this._deletedAt = '';
    this.bumpVersion(actor);
  }
}
