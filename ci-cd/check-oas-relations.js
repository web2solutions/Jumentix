/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { runWhenEntryPoint } = require('./lib/entry-point.js');

const ENTITY_SCHEMAS = ['User', 'Organization'];
const MODEL_FILES = {
  User: 'apps/backend-template/src/modules/Users/domain/Model/User.ts',
  Organization: 'apps/backend-template/src/modules/Users/domain/Model/Organization.ts'
};

const BELONGS_TO = /@belongsTo\(\(\)\s*=>\s*(\w+)\)\s*(?:public\s+)?(?:get\s+)?(\w+)/g;
const HAS_MANY = /@hasMany\(\(\)\s*=>\s*(\w+)\)\s*(?:public\s+)?(?:get\s+)?(\w+)/g;

function readSpec(root, specPath) {
  const fullPath = specPath || path.join(root, 'spec', '1.0.0.yml');
  return YAML.parse(fs.readFileSync(fullPath, 'utf8'));
}

function schemaProperties(schema) {
  if (!schema) return {};
  if (schema.properties) return schema.properties;
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((acc, part) => ({ ...acc, ...schemaProperties(part) }), {});
  }
  return {};
}

function collectOasRelations(document) {
  const relations = [];
  const keys = {};
  const schemas = document?.components?.schemas || {};
  for (const name of ENTITY_SCHEMAS) {
    const schema = schemas[name];
    if (!schema) continue;
    keys[name] = schema['x-primary-key'] || null;
    const properties = schemaProperties(schema);
    for (const [property, definition] of Object.entries(properties)) {
      const relation = definition?.['x-relation'];
      if (!relation) continue;
      relations.push({
        schema: name,
        property,
        entity: relation.entity,
        kind: relation.kind,
        match: relation.match || keys[relation.entity] || 'id'
      });
    }
  }
  return { relations, keys };
}

function collectModelRelations(sources) {
  const relations = [];
  const keys = {};
  for (const [schema, source] of Object.entries(sources)) {
    keys[schema] = 'id';
    const belongs = source.matchAll(new RegExp(BELONGS_TO.source, 'g'));
    for (const match of belongs) {
      relations.push({
        schema,
        property: match[2],
        entity: match[1],
        kind: 'belongsTo',
        match: 'id'
      });
    }
    const hasMany = source.matchAll(new RegExp(HAS_MANY.source, 'g'));
    for (const match of hasMany) {
      relations.push({
        schema,
        property: match[2],
        entity: match[1],
        kind: 'hasMany',
        match: 'id'
      });
    }
  }
  return { relations, keys };
}

function keyOf(item) {
  return `${item.schema}.${item.property}`;
}

function collectRelationErrors({ document, sources }) {
  const errors = [];
  const oas = collectOasRelations(document);
  const models = collectModelRelations(sources);

  for (const [schema, key] of Object.entries(models.keys)) {
    const declared = oas.keys[schema];
    if (!declared) {
      errors.push(`${schema}: missing x-primary-key, expected ${key}`);
    } else if (declared !== key) {
      errors.push(`${schema}: x-primary-key is "${declared}", expected "${key}"`);
    }
    const properties = schemaProperties(document?.components?.schemas?.[schema]);
    if (declared && properties && !(declared in properties)) {
      errors.push(`${schema}: x-primary-key "${declared}" is not a property`);
    }
  }

  const oasByKey = new Map(oas.relations.map((item) => [keyOf(item), item]));
  const modelByKey = new Map(models.relations.map((item) => [keyOf(item), item]));

  for (const [key, model] of modelByKey) {
    const spec = oasByKey.get(key);
    if (!spec) {
      errors.push(`${key}: model relation has no x-relation, expected entity=${model.entity} kind=${model.kind}`);
      continue;
    }
    if (spec.entity !== model.entity) {
      errors.push(`${key}: x-relation.entity is "${spec.entity}", expected "${model.entity}"`);
    }
    if (spec.kind !== model.kind) {
      errors.push(`${key}: x-relation.kind is "${spec.kind}", expected "${model.kind}"`);
    }
    if (spec.match !== model.match) {
      errors.push(`${key}: x-relation.match is "${spec.match}", expected "${model.match}"`);
    }
  }

  for (const [key, spec] of oasByKey) {
    if (!modelByKey.has(key)) {
      errors.push(`${key}: x-relation has no model decorator, expected entity=${spec.entity} kind=${spec.kind}`);
    }
  }

  return errors;
}

function loadModelSources(root) {
  const sources = {};
  for (const [name, relative] of Object.entries(MODEL_FILES)) {
    sources[name] = fs.readFileSync(path.join(root, relative), 'utf8');
  }
  return sources;
}

function main() {
  const root = process.cwd();
  const errors = collectRelationErrors({
    document: readSpec(root),
    sources: loadModelSources(root)
  });
  if (errors.length > 0) {
    console.error('OpenAPI relation reconciliation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    return 1;
  }
  console.log('OpenAPI relation reconciliation check passed.');
  return 0;
}

runWhenEntryPoint({ caller: module, execute: main });

module.exports = {
  collectOasRelations,
  collectModelRelations,
  collectRelationErrors,
  main
};
