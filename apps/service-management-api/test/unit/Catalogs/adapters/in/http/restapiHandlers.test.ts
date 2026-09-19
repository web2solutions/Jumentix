/* eslint-disable jest/max-expects, jest/prefer-expect-assertions */
import expressGetAll from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/getAllCatalogs';
import expressCreate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/createCatalog';
import expressGetOne from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/getCatalogById';
import expressUpdate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/updateCatalog';
import expressDelete from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/deleteCatalog';
import expressRestore from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/restoreCatalog';
import fastifyGetAll from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/getAllCatalogs';
import fastifyCreate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/createCatalog';
import fastifyGetOne from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/getCatalogById';
import fastifyUpdate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/updateCatalog';
import fastifyDelete from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/deleteCatalog';
import fastifyRestore from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/fastify/handlers/restoreCatalog';
import restifyGetAll from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/getAllCatalogs';
import restifyCreate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/createCatalog';
import restifyGetOne from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/getCatalogById';
import restifyUpdate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/updateCatalog';
import restifyDelete from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/deleteCatalog';
import restifyRestore from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/restify/handlers/restoreCatalog';
import { ConflictError } from '@src/infra/exceptions';

/**
 * Unit suite for the 18 catalog REST handlers (6 operations x 3 frameworks),
 * following the repository's direct-handler convention
 * (`createWebSocketOperationHandler.test.ts`): the REAL handler factories and
 * the REAL request-event classes run against a declared in-memory double of
 * the `IController` port (Requirement 115) and stubbed framework response
 * objects. What is pinned is Jumentix behavior — the path/method contract,
 * the event construction (entity/action, authorization and payload
 * forwarding), the success status/body mapping per framework, and the error
 * path through the REAL `sendErrorResponse` of each adapter.
 */

type OperationCase = {
  operationId: string;
  controllerMethod: string;
  action: string;
  path: string;
  httpMethod: string;
  successStatus: number;
  req: Record<string, any>;
  result: Record<string, any>;
  expectedResponse: unknown;
};

const OPERATIONS: OperationCase[] = [
  {
    operationId: 'getAllCatalogs',
    controllerMethod: 'getAll',
    action: 'getAll',
    path: '/catalogs',
    httpMethod: 'get',
    successStatus: 200,
    req: { query: {}, params: {}, headers: { authorization: 'Bearer token' } },
    result: {
      result: [{ id: 'catalog-1' }],
      page: 1,
      size: 10,
      total: 1
    },
    expectedResponse: {
      result: [{ id: 'catalog-1' }],
      error: undefined,
      page: 1,
      size: 10,
      total: 1
    }
  },
  {
    operationId: 'createCatalog',
    controllerMethod: 'create',
    action: 'create',
    path: '/catalogs',
    httpMethod: 'post',
    successStatus: 201,
    req: { body: { name: 'Billing', design: {} }, params: {}, headers: { authorization: 'Bearer token' } },
    result: { result: { id: 'catalog-1', version: 1 } },
    expectedResponse: { id: 'catalog-1', version: 1 }
  },
  {
    operationId: 'getCatalogById',
    controllerMethod: 'getOneById',
    action: 'getOneById',
    path: '/catalogs/{id}',
    httpMethod: 'get',
    successStatus: 200,
    req: { params: { id: 'catalog-1' }, query: {}, headers: { authorization: 'Bearer token' } },
    result: { result: { id: 'catalog-1', version: 2 } },
    expectedResponse: { id: 'catalog-1', version: 2 }
  },
  {
    operationId: 'updateCatalog',
    controllerMethod: 'update',
    action: 'update',
    path: '/catalogs/{id}',
    httpMethod: 'put',
    successStatus: 200,
    req: { params: { id: 'catalog-1' }, body: { version: 1 }, headers: { authorization: 'Bearer token' } },
    result: { result: { id: 'catalog-1', version: 2 } },
    expectedResponse: { id: 'catalog-1', version: 2 }
  },
  {
    operationId: 'deleteCatalog',
    controllerMethod: 'delete',
    action: 'delete',
    path: '/catalogs/{id}',
    httpMethod: 'delete',
    successStatus: 200,
    req: { params: { id: 'catalog-1' }, query: { version: '2' }, headers: { authorization: 'Bearer token' } },
    result: { result: true },
    expectedResponse: true
  },
  {
    operationId: 'restoreCatalog',
    controllerMethod: 'restore',
    action: 'restore',
    path: '/catalogs/{id}/restore',
    httpMethod: 'post',
    successStatus: 200,
    req: { params: { id: 'catalog-1' }, body: { version: 3 }, headers: { authorization: 'Bearer token' } },
    result: { result: { id: 'catalog-1', version: 4 } },
    expectedResponse: { id: 'catalog-1', version: 4 }
  }
];

const HANDLERS: Record<string, Record<string, any>> = {
  express: {
    getAllCatalogs: expressGetAll,
    createCatalog: expressCreate,
    getCatalogById: expressGetOne,
    updateCatalog: expressUpdate,
    deleteCatalog: expressDelete,
    restoreCatalog: expressRestore
  },
  fastify: {
    getAllCatalogs: fastifyGetAll,
    createCatalog: fastifyCreate,
    getCatalogById: fastifyGetOne,
    updateCatalog: fastifyUpdate,
    deleteCatalog: fastifyDelete,
    restoreCatalog: fastifyRestore
  },
  restify: {
    getAllCatalogs: restifyGetAll,
    createCatalog: restifyCreate,
    getCatalogById: restifyGetOne,
    updateCatalog: restifyUpdate,
    deleteCatalog: restifyDelete,
    restoreCatalog: restifyRestore
  }
};

const endPointConfig = { operationId: 'stub', security: [{ bearerAuth: ['read_catalog'] }] };

// Handlers legitimately mutate `req.query` (the page default) — every call
// gets a fresh copy so one framework's mutation cannot leak into another's.
const freshReq = (operation: OperationCase) => JSON.parse(JSON.stringify(operation.req));

const staleError = () => new ConflictError(
  'Stale catalog version: expected 1, current is 2',
  undefined,
  { catalogId: 'catalog-1', expectedVersion: 1, currentVersion: 2 }
);

function createControllerDouble(operation: OperationCase, mode: 'success' | 'error') {
  const captured: any[] = [];
  const double: Record<string, any> = {};
  double[operation.controllerMethod] = async (event: any) => {
    captured.push(event);
    if (mode === 'error') return { error: staleError() };
    return { ...operation.result };
  };
  return { double, captured };
}

describe('catalog REST handlers — express', () => {
  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });

  it.each(OPERATIONS)('$operationId maps the success path ($httpMethod $path)', async (operation) => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(operation, 'success');
    const factory = HANDLERS.express[operation.operationId];
    const endpoint = factory({ endPointConfig, controller: double });
    expect(endpoint.path).toBe(operation.path);
    expect(endpoint.method).toBe(operation.httpMethod);

    const res = makeRes();
    await endpoint.handler(freshReq(operation), res);

    expect(captured).toHaveLength(1);
    const event = captured[0];
    expect(event.entity).toBe('Catalog');
    expect(event.action).toBe(operation.action);
    expect(event.authorization).toBe('Bearer token');
    expect(res.status).toHaveBeenCalledWith(operation.successStatus);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toStrictEqual(operation.expectedResponse);
  });

  it.each(OPERATIONS)('$operationId maps controller errors to 409', async (operation) => {
    expect.hasAssertions();
    const { double } = createControllerDouble(operation, 'error');
    const endpoint = HANDLERS.express[operation.operationId]({
      endPointConfig,
      controller: double
    });
    const res = makeRes();
    await endpoint.handler(freshReq(operation), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('Conflict - Stale catalog version');
  });

  it('getAllCatalogs honours a caller-provided page parameter', async () => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(OPERATIONS[0], 'success');
    const endpoint = HANDLERS.express.getAllCatalogs({ endPointConfig, controller: double });
    const res = makeRes();
    await endpoint.handler({ query: { page: '3', size: '5' }, headers: { authorization: 'Bearer token' } }, res);
    expect(captured[0].queryString.page).toBe('3');
    expect(captured[0].queryString.size).toBe('5');
  });

  it('defaults absent query strings and reports absent authorization as an invalid event', async () => {
    expect.hasAssertions();
    const { double: getAllDouble, captured: getAllCaptured } = createControllerDouble(
      OPERATIONS[0],
      'success'
    );
    const getAllEndpoint = HANDLERS.express.getAllCatalogs({
      endPointConfig,
      controller: getAllDouble
    });
    const getAllRes = makeRes();
    await getAllEndpoint.handler({ params: {}, headers: { authorization: 'Bearer token' } }, getAllRes);

    const { double: deleteDouble, captured: deleteCaptured } = createControllerDouble(
      OPERATIONS[4],
      'success'
    );
    const deleteEndpoint = HANDLERS.express.deleteCatalog({
      endPointConfig,
      controller: deleteDouble
    });
    const deleteRes = makeRes();
    await deleteEndpoint.handler({ params: { id: 'catalog-1' }, headers: { authorization: 'Bearer token' } }, deleteRes);

    const authRes = makeRes();
    await getAllEndpoint.handler({ params: {}, query: {}, headers: {} }, authRes);

    expect(getAllCaptured[0].authorization).toBe('Bearer token');
    expect(getAllCaptured[0].queryString).toStrictEqual({ page: '1' });
    expect(deleteCaptured).toHaveLength(0);
    expect(deleteRes.status).toHaveBeenCalledWith(400);
    expect(authRes.status).toHaveBeenCalledWith(400);
  });

  it.each([OPERATIONS[1], OPERATIONS[2], OPERATIONS[3], OPERATIONS[4], OPERATIONS[5]])(
    '$operationId reports absent authorization as an invalid event',
    async (operation) => {
      expect.hasAssertions();
      const { double, captured } = createControllerDouble(operation, 'success');
      const endpoint = HANDLERS.express[operation.operationId]({
        endPointConfig,
        controller: double
      });
      const res = makeRes();
      const req = freshReq(operation);
      req.headers = {};

      await endpoint.handler(req, res);

      expect(captured).toHaveLength(0);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  );
});

describe('catalog REST handlers — fastify', () => {
  const makeRes = () => ({
    code: jest.fn().mockReturnThis(),
    send: jest.fn()
  });

  it.each(OPERATIONS)('$operationId maps the success path ($httpMethod $path)', async (operation) => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(operation, 'success');
    const endpoint = HANDLERS.fastify[operation.operationId]({
      endPointConfig,
      controller: double
    });
    expect(endpoint.path).toBe(operation.path);
    expect(endpoint.method).toBe(operation.httpMethod);

    const res = makeRes();
    const payload = await endpoint.handler(freshReq(operation), res);

    expect(captured).toHaveLength(1);
    expect(captured[0].entity).toBe('Catalog');
    expect(captured[0].action).toBe(operation.action);
    expect(res.code).toHaveBeenCalledWith(operation.successStatus);
    expect(payload).toStrictEqual(operation.expectedResponse);
  });

  it.each(OPERATIONS)('$operationId maps controller errors to 409', async (operation) => {
    expect.hasAssertions();
    const { double } = createControllerDouble(operation, 'error');
    const endpoint = HANDLERS.fastify[operation.operationId]({
      endPointConfig,
      controller: double
    });
    const res = makeRes();
    await endpoint.handler(freshReq(operation), res);
    expect(res.code).toHaveBeenCalledWith(409);
    expect(res.send.mock.calls[0][0].message).toContain('Conflict - Stale catalog version');
  });

  it('getAllCatalogs honours a caller-provided page parameter', async () => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(OPERATIONS[0], 'success');
    const endpoint = HANDLERS.fastify.getAllCatalogs({ endPointConfig, controller: double });
    const res = makeRes();
    await endpoint.handler({ query: { page: '2' }, headers: { authorization: 'Bearer token' } }, res);
    expect(captured[0].queryString.page).toBe('2');
  });

  it('defaults absent query strings and reports absent authorization as an invalid event', async () => {
    expect.hasAssertions();
    const { double: getAllDouble, captured: getAllCaptured } = createControllerDouble(
      OPERATIONS[0],
      'success'
    );
    const getAllEndpoint = HANDLERS.fastify.getAllCatalogs({
      endPointConfig,
      controller: getAllDouble
    });
    const getAllRes = makeRes();
    await getAllEndpoint.handler({ params: {}, headers: { authorization: 'Bearer token' } }, getAllRes);

    const { double: deleteDouble, captured: deleteCaptured } = createControllerDouble(
      OPERATIONS[4],
      'success'
    );
    const deleteEndpoint = HANDLERS.fastify.deleteCatalog({
      endPointConfig,
      controller: deleteDouble
    });
    const deleteRes = makeRes();
    await deleteEndpoint.handler({ params: { id: 'catalog-1' }, headers: { authorization: 'Bearer token' } }, deleteRes);

    const authRes = makeRes();
    await getAllEndpoint.handler({ params: {}, query: {}, headers: {} }, authRes);

    expect(getAllCaptured[0].authorization).toBe('Bearer token');
    expect(getAllCaptured[0].queryString).toStrictEqual({ page: '1' });
    expect(deleteCaptured).toHaveLength(0);
    expect(deleteRes.code).toHaveBeenCalledWith(400);
    expect(authRes.code).toHaveBeenCalledWith(400);
  });

  it.each([OPERATIONS[1], OPERATIONS[2], OPERATIONS[3], OPERATIONS[4], OPERATIONS[5]])(
    '$operationId reports absent authorization as an invalid event',
    async (operation) => {
      expect.hasAssertions();
      const { double, captured } = createControllerDouble(operation, 'success');
      const endpoint = HANDLERS.fastify[operation.operationId]({
        endPointConfig,
        controller: double
      });
      const res = makeRes();
      const req = freshReq(operation);
      req.headers = {};

      await endpoint.handler(req, res);

      expect(captured).toHaveLength(0);
      expect(res.code).toHaveBeenCalledWith(400);
    }
  );
});

describe('catalog REST handlers — restify', () => {
  const makeRes = () => ({
    status: jest.fn(),
    json: jest.fn()
  });

  it.each(OPERATIONS)('$operationId maps the success path ($httpMethod $path)', async (operation) => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(operation, 'success');
    const endpoint = HANDLERS.restify[operation.operationId]({
      endPointConfig,
      controller: double
    });
    expect(endpoint.path).toBe(operation.path);
    expect(endpoint.method).toBe(operation.httpMethod);

    const res = makeRes();
    await endpoint.handler(freshReq(operation), res);

    expect(captured).toHaveLength(1);
    expect(captured[0].entity).toBe('Catalog');
    expect(captured[0].action).toBe(operation.action);
    expect(res.status).toHaveBeenCalledWith(operation.successStatus);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toStrictEqual(operation.expectedResponse);
  });

  it.each(OPERATIONS)('$operationId maps controller errors to 409', async (operation) => {
    expect.hasAssertions();
    const { double } = createControllerDouble(operation, 'error');
    const endpoint = HANDLERS.restify[operation.operationId]({
      endPointConfig,
      controller: double
    });
    const res = makeRes();
    await endpoint.handler(freshReq(operation), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('Conflict - Stale catalog version');
  });

  it('getAllCatalogs honours a caller-provided page parameter', async () => {
    expect.hasAssertions();
    const { double, captured } = createControllerDouble(OPERATIONS[0], 'success');
    const endpoint = HANDLERS.restify.getAllCatalogs({ endPointConfig, controller: double });
    const res = makeRes();
    await endpoint.handler({ query: { page: '4' }, headers: { authorization: 'Bearer token' } }, res);
    expect(captured[0].queryString.page).toBe('4');
  });

  it('defaults absent query strings and reports absent authorization as an invalid event', async () => {
    expect.hasAssertions();
    const { double: getAllDouble, captured: getAllCaptured } = createControllerDouble(
      OPERATIONS[0],
      'success'
    );
    const getAllEndpoint = HANDLERS.restify.getAllCatalogs({
      endPointConfig,
      controller: getAllDouble
    });
    const getAllRes = makeRes();
    await getAllEndpoint.handler({ params: {}, headers: { authorization: 'Bearer token' } }, getAllRes);

    const { double: deleteDouble, captured: deleteCaptured } = createControllerDouble(
      OPERATIONS[4],
      'success'
    );
    const deleteEndpoint = HANDLERS.restify.deleteCatalog({
      endPointConfig,
      controller: deleteDouble
    });
    const deleteRes = makeRes();
    await deleteEndpoint.handler({ params: { id: 'catalog-1' }, headers: { authorization: 'Bearer token' } }, deleteRes);

    const authRes = makeRes();
    await getAllEndpoint.handler({ params: {}, query: {}, headers: {} }, authRes);

    expect(getAllCaptured[0].authorization).toBe('Bearer token');
    expect(getAllCaptured[0].queryString).toStrictEqual({ page: '1' });
    expect(deleteCaptured).toHaveLength(0);
    expect(deleteRes.status).toHaveBeenCalledWith(400);
    expect(authRes.status).toHaveBeenCalledWith(400);
  });

  it.each([OPERATIONS[1], OPERATIONS[2], OPERATIONS[3], OPERATIONS[4], OPERATIONS[5]])(
    '$operationId reports absent authorization as an invalid event',
    async (operation) => {
      expect.hasAssertions();
      const { double, captured } = createControllerDouble(operation, 'success');
      const endpoint = HANDLERS.restify[operation.operationId]({
        endPointConfig,
        controller: double
      });
      const res = makeRes();
      const req = freshReq(operation);
      req.headers = {};

      await endpoint.handler(req, res);

      expect(captured).toHaveLength(0);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  );
});
