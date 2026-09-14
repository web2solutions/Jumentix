/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects,
  jest/no-conditional-in-test */

import { ValidationError } from '@src/infra/exceptions';
import type { EndPointFactory } from '@src/interface/HTTP/ports';

import login from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/login';
import logout from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/logout';
import register from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/register';
import updateUserPassword from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateUserPassword';
import getAll from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/getAll';
import create from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/create';
import update from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/update';
import deleteOne from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteOne';
import getOneById from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/getOneById';
import updatePassword from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updatePassword';
import createEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createEmail';
import updateEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateEmail';
import deleteEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteEmail';
import createPhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createPhone';
import updatePhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updatePhone';
import deletePhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deletePhone';
import createOrganization from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createOrganization';
import getAllOrganizations from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/getAllOrganizations';
import getOrganizationById from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/getOrganizationById';
import updateOrganization from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateOrganization';
import deleteOrganization from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteOrganization';
import createDocument from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createDocument';
import deleteDocument from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteDocument';
import updateDocument from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateDocument';
import updateOrganizationAddress from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateOrganizationAddress';
import createOrganizationEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createOrganizationEmail';
import updateOrganizationEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateOrganizationEmail';
import deleteOrganizationEmail from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteOrganizationEmail';
import createOrganizationPhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createOrganizationPhone';
import updateOrganizationPhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/updateOrganizationPhone';
import deleteOrganizationPhone from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteOrganizationPhone';
import createOrganizationAddress from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/createOrganizationAddress';
import deleteOrganizationAddress from '@src/modules/Users/interface/restapi/frameworks/derby-js/handlers/deleteOrganizationAddress';

/**
 * The derby-js REST handlers, driven as the derby adapter drives them.
 *
 * Same adapter contract as the express variants: the domain event the
 * controller receives (type, authorization, input, params, schema), the
 * status and body the client receives, and the error mapping when the
 * controller or the event validation reports a failure. The mutation
 * factories (`_documentMutationHandlerFactory`,
 * `_organizationMutationHandlerFactory`) tolerate requests without `params`
 * or `headers` — the event validation then rejects them, which is asserted
 * rather than assumed.
 */

const SCHEMA_OAS = { operationId: 'probe' } as any;
const AUTH = 'Bearer derby-token';

const makeRes = () => {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const makeReq = (overrides: Record<string, any> = {}): any => ({
  headers: { authorization: AUTH },
  params: { id: 'user-1' },
  body: { name: 'payload' },
  query: {},
  ...overrides
});

type HandlerCase = {
  name: string;
  factory: EndPointFactory;
  method: string;
  path: string;
  controllerMethod: string;
  status: number;
  eventType: string;
  result: any;
  req: () => any;
  expectedEvent: Record<string, any>;
  expectedBody?: (result: any) => any;
  readsAuth: boolean;
  authEnforced?: boolean;
};

const withBody = { input: { name: 'payload' } };
const withParams = { params: { id: 'user-1' } };
const PAGING = { page: 1, size: 10, total: 1 };

const HANDLERS: HandlerCase[] = [
  {
    name: 'login',
    factory: login,
    method: 'post',
    path: '/auth/login',
    controllerMethod: 'login',
    status: 200,
    eventType: 'LoginRequestEvent',
    result: { token: 'jwt' },
    req: () => makeReq(),
    expectedEvent: { ...withBody },
    readsAuth: false
  },
  {
    name: 'register',
    factory: register,
    method: 'post',
    path: '/auth/register',
    controllerMethod: 'register',
    status: 201,
    eventType: 'RegisterRequestEvent',
    result: { id: 'user-1' },
    req: () => makeReq(),
    expectedEvent: { ...withBody },
    readsAuth: false
  },
  {
    name: 'logout',
    factory: logout,
    method: 'post',
    path: '/auth/logout',
    controllerMethod: 'logout',
    status: 200,
    eventType: 'LogoutRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody },
    readsAuth: true,
    authEnforced: false
  },
  {
    name: 'updateUserPassword',
    factory: updateUserPassword,
    method: 'post',
    path: '/auth/updateUserPassword',
    controllerMethod: 'updatePassword',
    status: 200,
    eventType: 'UpdatePasswordRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody },
    readsAuth: true,
    authEnforced: false
  },
  {
    name: 'getAll',
    factory: getAll,
    method: 'get',
    path: '/users',
    controllerMethod: 'getAll',
    status: 200,
    eventType: 'UserGetAllRequestEvent',
    result: [{ id: 'user-1' }],
    req: () => makeReq({ query: { page: '3', size: '5' } }),
    expectedEvent: { authorization: AUTH, queryString: { page: '3', size: '5' } },
    expectedBody: (result) => ({ result, error: undefined, ...PAGING }),
    readsAuth: true
  },
  {
    name: 'create',
    factory: create,
    method: 'post',
    path: '/users',
    controllerMethod: 'create',
    status: 201,
    eventType: 'UserCreateRequestEvent',
    result: { id: 'user-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody },
    readsAuth: true
  },
  {
    name: 'update',
    factory: update,
    method: 'put',
    path: '/users/{id}',
    controllerMethod: 'update',
    status: 200,
    eventType: 'UserUpdateRequestEvent',
    result: { id: 'user-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'deleteOne',
    factory: deleteOne,
    method: 'delete',
    path: '/users/{id}',
    controllerMethod: 'delete',
    status: 200,
    eventType: 'UserDeleteRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  },
  {
    name: 'getOneById',
    factory: getOneById,
    method: 'get',
    path: '/users/{id}',
    controllerMethod: 'getOneById',
    status: 200,
    eventType: 'UserGetOneRequestEvent',
    result: { id: 'user-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  },
  {
    name: 'updatePassword',
    factory: updatePassword,
    method: 'put',
    path: '/users/{id}/updatePassword',
    controllerMethod: 'updatePassword',
    status: 200,
    eventType: 'UserPasswordUpdateRequestEvent',
    result: { id: 'user-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'createEmail',
    factory: createEmail,
    method: 'post',
    path: '/users/{id}/createEmail',
    controllerMethod: 'createEmail',
    status: 201,
    eventType: 'UserEmailCreateRequestEvent',
    result: { id: 'email-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'updateEmail',
    factory: updateEmail,
    method: 'put',
    path: '/users/{id}/updateEmail/{emailId}',
    controllerMethod: 'updateEmail',
    status: 200,
    eventType: 'UserEmailUpdateRequestEvent',
    result: { id: 'email-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'deleteEmail',
    factory: deleteEmail,
    method: 'delete',
    path: '/users/{id}/deleteEmail/{emailId}',
    controllerMethod: 'deleteEmail',
    status: 200,
    eventType: 'UserEmailDeleteRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  },
  {
    name: 'createPhone',
    factory: createPhone,
    method: 'post',
    path: '/users/{id}/createPhone',
    controllerMethod: 'createPhone',
    status: 201,
    eventType: 'UserPhoneCreateRequestEvent',
    result: { id: 'phone-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'updatePhone',
    factory: updatePhone,
    method: 'put',
    path: '/users/{id}/updatePhone/{phoneId}',
    controllerMethod: 'updatePhone',
    status: 200,
    eventType: 'UserPhoneUpdateRequestEvent',
    result: { id: 'phone-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'deletePhone',
    factory: deletePhone,
    method: 'delete',
    path: '/users/{id}/deletePhone/{phoneId}',
    controllerMethod: 'deletePhone',
    status: 200,
    eventType: 'UserPhoneDeleteRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  },
  {
    name: 'createOrganization',
    factory: createOrganization,
    method: 'post',
    path: '/organizations',
    controllerMethod: 'createOrganization',
    status: 201,
    eventType: 'OrganizationCreateRequestEvent',
    result: { id: 'org-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody },
    readsAuth: true
  },
  {
    name: 'getAllOrganizations',
    factory: getAllOrganizations,
    method: 'get',
    path: '/organizations',
    controllerMethod: 'getAllOrganizations',
    status: 200,
    eventType: 'OrganizationGetAllRequestEvent',
    result: [{ id: 'org-1' }],
    req: () => makeReq({ query: { page: '2', size: '10' } }),
    expectedEvent: { authorization: AUTH, queryString: { page: '2', size: '10' } },
    expectedBody: (result) => ({ result, error: undefined, ...PAGING }),
    readsAuth: true
  },
  {
    name: 'getOrganizationById',
    factory: getOrganizationById,
    method: 'get',
    path: '/organizations/{id}',
    controllerMethod: 'getOrganizationById',
    status: 200,
    eventType: 'OrganizationGetOneRequestEvent',
    result: { id: 'org-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  },
  {
    name: 'updateOrganization',
    factory: updateOrganization,
    method: 'put',
    path: '/organizations/{id}',
    controllerMethod: 'updateOrganization',
    status: 200,
    eventType: 'OrganizationUpdateRequestEvent',
    result: { id: 'org-1' },
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withBody, ...withParams },
    readsAuth: true
  },
  {
    name: 'deleteOrganization',
    factory: deleteOrganization,
    method: 'delete',
    path: '/organizations/{id}',
    controllerMethod: 'deleteOrganization',
    status: 200,
    eventType: 'OrganizationDeleteRequestEvent',
    result: true,
    req: () => makeReq(),
    expectedEvent: { authorization: AUTH, ...withParams },
    readsAuth: true
  }
];

describe('derby-js restapi handlers', () => {
  describe.each(HANDLERS.map((entry) => [entry.name, entry] as [string, HandlerCase]))(
    '%s',
    (_name, entry) => {
      it(`answers ${entry.method} ${entry.path} with ${entry.status} and the controller result`, async () => {
        expect.hasAssertions();

        const controller = {
          [entry.controllerMethod]: jest.fn().mockResolvedValue({
            result: entry.result, ...PAGING
          })
        };
        const endpoint = entry.factory({ endPointConfig: SCHEMA_OAS, controller } as any);

        expect(endpoint.method).toBe(entry.method);
        expect(endpoint.path).toBe(entry.path);

        const res = makeRes();
        await endpoint.handler(entry.req(), res);

        const expected = entry.expectedBody
          ? entry.expectedBody(entry.result)
          : entry.result;
        expect(res.status).toHaveBeenCalledWith(entry.status);
        expect(res.json).toHaveBeenCalledWith(expected);

        const [event] = controller[entry.controllerMethod].mock.calls[0];
        expect(event.type).toBe(entry.eventType);
        expect(event).toMatchObject({ ...entry.expectedEvent, schemaOAS: SCHEMA_OAS });
      });

      if (entry.readsAuth && entry.authEnforced !== false) {
        it('answers 400 without calling the controller when authorization is missing', async () => {
          expect.hasAssertions();

          // The domain event validates the message: an empty authorization is
          // rejected before the use case runs, and the handler maps it.
          const controller = {
            [entry.controllerMethod]: jest.fn().mockResolvedValue({
              result: entry.result, ...PAGING
            })
          };
          const endpoint = entry.factory({ endPointConfig: SCHEMA_OAS, controller } as any);

          const res = makeRes();
          await endpoint.handler(makeReq({ headers: {}, query: {} }), res);

          expect(controller[entry.controllerMethod]).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('authorization can not be empty')
          }));
        });
      }

      if (entry.readsAuth && entry.authEnforced === false) {
        it('forwards an empty authorization to the controller when the event allows it', async () => {
          expect.hasAssertions();

          const controller = {
            [entry.controllerMethod]: jest.fn().mockResolvedValue({
              result: entry.result, ...PAGING
            })
          };
          const endpoint = entry.factory({ endPointConfig: SCHEMA_OAS, controller } as any);

          const res = makeRes();
          await endpoint.handler(makeReq({ headers: {}, query: {} }), res);

          const [event] = controller[entry.controllerMethod].mock.calls[0];
          expect(event.authorization).toBe('');
          expect(res.status).toHaveBeenCalledWith(entry.status);
        });
      }

      it('maps a controller error to the error response', async () => {
        expect.hasAssertions();

        const controller = {
          [entry.controllerMethod]: jest.fn().mockResolvedValue({
            error: new ValidationError('invalid payload')
          })
        };
        const endpoint = entry.factory({ endPointConfig: SCHEMA_OAS, controller } as any);

        const res = makeRes();
        await endpoint.handler(entry.req(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining('invalid payload')
        }));
      });
    }
  );

  describe.each([
    ['getAll', getAll, 'getAll', 'UserGetAllRequestEvent'],
    ['getAllOrganizations', getAllOrganizations, 'getAllOrganizations', 'OrganizationGetAllRequestEvent']
  ] as const)('%s pagination', (_name, factory, controllerMethod, eventType) => {
    it('defaults the page to 1 and keeps explicit paging and filters', async () => {
      expect.hasAssertions();

      const controller = {
        [controllerMethod]: jest.fn().mockResolvedValue({ result: [], ...PAGING })
      };
      const endpoint = factory({ endPointConfig: SCHEMA_OAS, controller } as any);

      await endpoint.handler(makeReq({ query: { size: '5' } }), makeRes());
      const [defaulted] = controller[controllerMethod].mock.calls[0];
      expect(defaulted.type).toBe(eventType);
      expect(defaulted.queryString).toStrictEqual({ size: '5', page: 1 });

      // A request without a query string at all still paginates.
      await endpoint.handler(makeReq({ query: undefined }), makeRes());
      const [noQuery] = controller[controllerMethod].mock.calls[1];
      expect(noQuery.queryString).toStrictEqual({ page: 1 });
    });
  });

  describe('document mutation factory', () => {
    it('builds the create-document endpoint reading the body by default', async () => {
      expect.hasAssertions();

      const controller = {
        createDocument: jest.fn().mockResolvedValue({ result: { id: 'doc-1' } })
      };
      const endpoint = createDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      expect(endpoint.method).toBe('post');
      expect(endpoint.path).toBe('/users/{id}/createDocument');

      const res = makeRes();
      await endpoint.handler(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'doc-1' });
      const [event] = controller.createDocument.mock.calls[0];
      expect(event.type).toBe('UserDocumentCreateRequestEvent');
      expect(event).toMatchObject({
        authorization: AUTH,
        input: { name: 'payload' },
        params: { id: 'user-1' },
        schemaOAS: SCHEMA_OAS
      });
    });

    it('builds the delete-document endpoint without reading a body', async () => {
      expect.hasAssertions();

      const controller = {
        deleteDocument: jest.fn().mockResolvedValue({ result: true })
      };
      const endpoint = deleteDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      expect(endpoint.method).toBe('delete');
      expect(endpoint.path).toBe('/users/{id}/deleteDocument/{documentId}');

      const res = makeRes();
      // A body on a delete request must not leak into the domain event.
      await endpoint.handler(
        makeReq({ params: { id: 'user-1', documentId: 'doc-1' }, body: { rogue: true } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(true);
      const [event] = controller.deleteDocument.mock.calls[0];
      expect(event.type).toBe('UserDocumentDeleteRequestEvent');
      expect(event.input).toStrictEqual({});
    });

    it('maps a factory-built endpoint error to the error response', async () => {
      expect.hasAssertions();

      const controller = {
        createDocument: jest.fn().mockResolvedValue({
          error: new ValidationError('document refused')
        })
      };
      const endpoint = createDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('document refused')
      }));
    });

    it('maps an unexpected failure without a known code to HTTP 500', async () => {
      expect.hasAssertions();

      const controller = {
        createDocument: jest.fn().mockResolvedValue({ error: new Error('unexpected boom') })
      };
      const endpoint = createDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it('builds the update-document endpoint with its configured route', async () => {
      expect.hasAssertions();

      const controller = {
        updateDocument: jest.fn().mockResolvedValue({ result: { id: 'doc-1' } })
      };
      const endpoint = updateDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      expect(endpoint.method).toBe('put');
      expect(endpoint.path).toBe('/users/{id}/updateDocument/{documentId}');

      const res = makeRes();
      await endpoint.handler(
        makeReq({ params: { id: 'user-1', documentId: 'doc-1' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'doc-1' });
      const [event] = controller.updateDocument.mock.calls[0];
      expect(event.type).toBe('UserDocumentUpdateRequestEvent');
      expect(event).toMatchObject({
        authorization: AUTH,
        input: { name: 'payload' },
        params: { id: 'user-1', documentId: 'doc-1' }
      });
    });

    it('rejects requests without params or headers through event validation', async () => {
      expect.hasAssertions();

      // The factory tolerates the missing request parts (`req.params || {}`,
      // `req.headers?.authorization`); the event validation is what turns
      // them into a 400 rather than a crash.
      const controller = {
        createDocument: jest.fn().mockResolvedValue({ result: { id: 'doc-1' } })
      };
      const endpoint = createDocument({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler({ body: { name: 'payload' }, query: {} } as any, res);

      expect(controller.createDocument).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('can not be empty')
      }));
    });
  });

  describe('organization sub-resource mutation factory', () => {
    it('builds the create-address endpoint reading the body by default', async () => {
      expect.hasAssertions();

      const controller = {
        createOrganizationAddress: jest.fn().mockResolvedValue({ result: { id: 'addr-1' } })
      };
      const endpoint = createOrganizationAddress({ endPointConfig: SCHEMA_OAS, controller } as any);

      expect(endpoint.method).toBe('post');
      expect(endpoint.path).toBe('/organizations/{id}/createAddress');

      const res = makeRes();
      await endpoint.handler(makeReq({ params: { id: 'org-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'addr-1' });
      const [event] = controller.createOrganizationAddress.mock.calls[0];
      expect(event.type).toBe('OrganizationAddressCreateRequestEvent');
      expect(event).toMatchObject({
        authorization: AUTH,
        input: { name: 'payload' },
        params: { id: 'org-1' },
        schemaOAS: SCHEMA_OAS
      });
    });

    it('builds the delete-address endpoint without reading a body', async () => {
      expect.hasAssertions();

      const controller = {
        deleteOrganizationAddress: jest.fn().mockResolvedValue({ result: true })
      };
      const endpoint = deleteOrganizationAddress({ endPointConfig: SCHEMA_OAS, controller } as any);

      expect(endpoint.method).toBe('delete');
      expect(endpoint.path).toBe('/organizations/{id}/deleteAddress/{addressId}');

      const res = makeRes();
      await endpoint.handler(
        makeReq({ params: { id: 'org-1', addressId: 'addr-1' }, body: { rogue: true } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(true);
      const [event] = controller.deleteOrganizationAddress.mock.calls[0];
      expect(event.type).toBe('OrganizationAddressDeleteRequestEvent');
      expect(event.input).toStrictEqual({});
    });

    it('maps a controller error from a factory-built endpoint to the error response', async () => {
      expect.hasAssertions();

      const controller = {
        createOrganizationAddress: jest.fn().mockResolvedValue({
          error: new ValidationError('address refused')
        })
      };
      const endpoint = createOrganizationAddress({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler(makeReq({ params: { id: 'org-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('address refused')
      }));
    });

    it('maps an unexpected failure without a known code to HTTP 500', async () => {
      expect.hasAssertions();

      const controller = {
        createOrganizationAddress: jest.fn().mockResolvedValue({
          error: new Error('unexpected boom')
        })
      };
      const endpoint = createOrganizationAddress({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler(makeReq({ params: { id: 'org-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it('rejects sub-resource requests without params or headers through event validation', async () => {
      expect.hasAssertions();

      const controller = {
        deleteOrganizationAddress: jest.fn().mockResolvedValue({ result: true })
      };
      const endpoint = deleteOrganizationAddress({ endPointConfig: SCHEMA_OAS, controller } as any);

      const res = makeRes();
      await endpoint.handler({ query: {} } as any, res);

      expect(controller.deleteOrganizationAddress).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('can not be empty')
      }));
    });
  });

  describe('organization email/phone sub-resource wrappers', () => {
    const SUBRESOURCE_WRAPPERS = [
      ['updateOrganizationAddress', updateOrganizationAddress, 'put',
        '/organizations/{id}/updateAddress/{addressId}', 200, 'OrganizationAddressUpdateRequestEvent',
        { id: 'org-1', addressId: 'addr-1' }, { street: 'main' }],
      ['createOrganizationEmail', createOrganizationEmail, 'post',
        '/organizations/{id}/createEmail', 201, 'OrganizationEmailCreateRequestEvent',
        { id: 'org-1' }, { email: 'ops@example.com' }],
      ['updateOrganizationEmail', updateOrganizationEmail, 'put',
        '/organizations/{id}/updateEmail/{emailId}', 200, 'OrganizationEmailUpdateRequestEvent',
        { id: 'org-1', emailId: 'email-1' }, { email: 'ops@example.com' }],
      ['deleteOrganizationEmail', deleteOrganizationEmail, 'delete',
        '/organizations/{id}/deleteEmail/{emailId}', 200, 'OrganizationEmailDeleteRequestEvent',
        { id: 'org-1', emailId: 'email-1' }, undefined],
      ['createOrganizationPhone', createOrganizationPhone, 'post',
        '/organizations/{id}/createPhone', 201, 'OrganizationPhoneCreateRequestEvent',
        { id: 'org-1' }, { number: '999' }],
      ['updateOrganizationPhone', updateOrganizationPhone, 'put',
        '/organizations/{id}/updatePhone/{phoneId}', 200, 'OrganizationPhoneUpdateRequestEvent',
        { id: 'org-1', phoneId: 'phone-1' }, { number: '999' }],
      ['deleteOrganizationPhone', deleteOrganizationPhone, 'delete',
        '/organizations/{id}/deletePhone/{phoneId}', 200, 'OrganizationPhoneDeleteRequestEvent',
        { id: 'org-1', phoneId: 'phone-1' }, undefined]
    ] as const;

    it.each(SUBRESOURCE_WRAPPERS)(
      '%s answers with its configured route and status',
      async (controllerMethod, factory, method, path, status, eventType, params, body) => {
        expect.hasAssertions();

        const controller = {
          [controllerMethod]: jest.fn().mockResolvedValue({ result: { ok: true } })
        };
        const endpoint = factory({ endPointConfig: SCHEMA_OAS, controller } as any);

        expect(endpoint.method).toBe(method);
        expect(endpoint.path).toBe(path);

        const res = makeRes();
        await endpoint.handler(makeReq({ params, body }), res);

        expect(res.status).toHaveBeenCalledWith(status);
        expect(res.json).toHaveBeenCalledWith({ ok: true });
        const [event] = controller[controllerMethod].mock.calls[0];
        expect(event.type).toBe(eventType);
        expect(event).toMatchObject({ authorization: AUTH, params, schemaOAS: SCHEMA_OAS });
        expect(event.input).toStrictEqual(body ?? {});
      }
    );
  });
});
