export type EntityConstructor<T = any> = new (...args: any[]) => T;
export type BelongsTo<T extends EntityConstructor> = InstanceType<T> | null;
export type HasMany<T extends EntityConstructor> = InstanceType<T>[];
export type RelationKind = 'belongsTo' | 'hasMany';

export interface IModelRelationMetadata {
  property: string;
  kind: RelationKind;
  target: string;
}

const RELATIONS_KEY = Symbol.for('aaa:model:relations');

interface IStoredRelation {
  property: string;
  kind: RelationKind;
  targetFactory: () => EntityConstructor;
}

const appendRelation = (
  target: any,
  property: string,
  kind: RelationKind,
  targetFactory: () => EntityConstructor
): void => {
  const ctor = target.constructor as any;
  const current: IStoredRelation[] = ctor[RELATIONS_KEY] || [];
  ctor[RELATIONS_KEY] = [...current, { property, kind, targetFactory }];
};

export const belongsTo = (targetFactory: () => EntityConstructor): PropertyDecorator => {
  return (target: object, propertyKey: string | symbol) => {
    appendRelation(target, propertyKey.toString(), 'belongsTo', targetFactory);
  };
};

export const hasMany = (targetFactory: () => EntityConstructor): PropertyDecorator => {
  return (target: object, propertyKey: string | symbol) => {
    appendRelation(target, propertyKey.toString(), 'hasMany', targetFactory);
  };
};

export const getModelRelations = (model: EntityConstructor): IModelRelationMetadata[] => {
  const ctor = model as any;
  const stored: IStoredRelation[] = ctor[RELATIONS_KEY] || [];
  return stored.map((relation) => ({
    property: relation.property,
    kind: relation.kind,
    target: relation.targetFactory().name
  }));
};
