/* eslint-disable jest/max-expects */
import { RestAPI } from '@src/interface/HTTP/RestAPI';

// A handler module whose default export is truthy but not callable must not
// be invoked — it falls through to the next framework candidate and ends in
// the loud "Handler not found" error, matching RealtimeAPIBase's typeof guard.
jest.mock('@src/modules/Users/interface/restapi/frameworks/express/handlers/logout', () => ({
  default: 42
}));

describe('restAPI handler factory with a non-function default export', () => {
  it('falls through instead of calling a truthy non-function default', () => {
    expect.hasAssertions();

    const api = Object.create(RestAPI.prototype);
    expect(() => (api as any).getHandlerFactory({
      moduleName: 'Users',
      operationId: 'logout',
      endPointConfig: { operationId: 'logout' }
    })).toThrow(
      'Handler not found for module Users, operation logout, framework undefined.'
    );
  });
});
