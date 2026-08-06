/**
 * asyncApi30Validation — structural validator for AsyncAPI 3.0 documents
 * (JUM-475).
 *
 * The repository does not depend on `@asyncapi/parser`, so this module is
 * the in-repo equivalent of the OAS route-resolution gate for the event
 * lane: it checks the 3.0 document shape the canonical `spec/asyncapi/`
 * files and the designer export both commit to — `asyncapi: 3.x`, `info`,
 * servers, channels with `address`/`messages`, the top-level `operations`
 * map with `action: send|receive`, and `$ref` integrity between operations,
 * channels, messages and schemas. A document that passes here parses as
 * AsyncAPI 3.0; a 2.x-shaped document (publish/subscribe under channels)
 * fails, which is exactly the drift this gate exists to catch.
 *
 * DOM-free and dependency-free, like the rest of `src/`.
 */

const ACTIONS = new Set(['send', 'receive']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveLocalRef(document, ref, expectedPrefix) {
  if (typeof ref !== 'string' || !ref.startsWith(expectedPrefix)) return null;
  const segments = ref.slice(2).split('/');
  let node = document;
  let index = 0;
  while (index < segments.length) {
    if (!isObject(node)) return null;
    // Channel keys may themselves contain '/' (the canonical
    // `api/request` convention), so match the longest remaining key first —
    // plain JSON Pointer splitting alone cannot resolve those refs.
    let matched = false;
    for (let end = segments.length; end > index; end -= 1) {
      const key = segments.slice(index, end).join('/');
      if (key in node) {
        node = node[key];
        index = end;
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return node;
}

/**
 * Validates an AsyncAPI document against the 3.0 structural rules.
 * @returns {string[]} the list of violations; empty means valid.
 */
export function validateAsyncApi30Document(document) {
  const errors = [];
  if (!isObject(document)) return ['document must be an object'];

  const specVersion = String(document.asyncapi || '');
  if (!/^3\.\d+\.\d+$/.test(specVersion)) {
    errors.push(`asyncapi must declare a 3.x version, got "${specVersion || '<missing>'}"`);
  }

  if (!isObject(document.info)) {
    errors.push('info is required');
  } else {
    if (!String(document.info.title || '').trim()) errors.push('info.title is required');
    if (!String(document.info.version || '').trim()) errors.push('info.version is required');
  }

  if (document.servers !== undefined) {
    if (!isObject(document.servers)) {
      errors.push('servers must be a map');
    } else {
      Object.entries(document.servers).forEach(([name, server]) => {
        if (!isObject(server) || !String(server.host || '').trim() || !String(server.protocol || '').trim()) {
          errors.push(`servers.${name} must declare host and protocol`);
        }
      });
    }
  }

  if (document.channels !== undefined && !isObject(document.channels)) {
    errors.push('channels must be a map');
  }
  const channels = isObject(document.channels) ? document.channels : {};
  Object.entries(channels).forEach(([channelKey, channel]) => {
    if (!isObject(channel)) {
      errors.push(`channels.${channelKey} must be an object`);
      return;
    }
    if (channel.address !== undefined && typeof channel.address !== 'string') {
      errors.push(`channels.${channelKey}.address must be a string`);
    }
    if (channel.messages !== undefined && !isObject(channel.messages)) {
      errors.push(`channels.${channelKey}.messages must be a map`);
    }
    Object.entries(isObject(channel.messages) ? channel.messages : {}).forEach(([messageKey, message]) => {
      if (!isObject(message)) {
        errors.push(`channels.${channelKey}.messages.${messageKey} must be an object`);
        return;
      }
      if (message.$ref !== undefined && !resolveLocalRef(document, message.$ref, '#/components/messages/')) {
        errors.push(`channels.${channelKey}.messages.${messageKey} $ref does not resolve: ${message.$ref}`);
      }
    });
  });

  if (document.operations !== undefined && !isObject(document.operations)) {
    errors.push('operations must be a map');
  }
  const operations = isObject(document.operations) ? document.operations : {};
  Object.entries(operations).forEach(([operationKey, operation]) => {
    if (!isObject(operation)) {
      errors.push(`operations.${operationKey} must be an object`);
      return;
    }
    if (!ACTIONS.has(operation.action)) {
      errors.push(`operations.${operationKey}.action must be send|receive, got "${operation.action}"`);
    }
    if (!isObject(operation.channel) || typeof operation.channel.$ref !== 'string') {
      errors.push(`operations.${operationKey}.channel must be a $ref to a channel`);
    } else if (!resolveLocalRef(document, operation.channel.$ref, '#/channels/')) {
      errors.push(`operations.${operationKey}.channel $ref does not resolve: ${operation.channel.$ref}`);
    }
    if (operation.messages !== undefined) {
      if (!Array.isArray(operation.messages)) {
        errors.push(`operations.${operationKey}.messages must be a list`);
      } else {
        operation.messages.forEach((message, index) => {
          const ref = isObject(message) ? message.$ref : undefined;
          if (typeof ref !== 'string' || !resolveLocalRef(document, ref, '#/')) {
            errors.push(`operations.${operationKey}.messages.${index} $ref does not resolve: ${ref}`);
          }
        });
      }
    }
  });

  const components = isObject(document.components) ? document.components : {};
  const messages = isObject(components.messages) ? components.messages : {};
  Object.entries(messages).forEach(([messageName, message]) => {
    if (!isObject(message)) {
      errors.push(`components.messages.${messageName} must be an object`);
      return;
    }
    if (isObject(message.payload) && typeof message.payload.$ref === 'string'
      && !resolveLocalRef(document, message.payload.$ref, '#/components/schemas/')) {
      errors.push(`components.messages.${messageName}.payload $ref does not resolve: ${message.payload.$ref}`);
    }
  });

  return errors;
}
