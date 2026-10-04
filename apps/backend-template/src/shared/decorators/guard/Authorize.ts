/* eslint-disable func-names */

import UserMessageContracts from '@src/modules/Users/events/contracts/UserMessageContracts';

function Authorize(): Function {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    // eslint-disable-next-line no-param-reassign
    descriptor.value = async function (...args: any[]) {
      const [event] = args;
      const { messageMediator, authService } = this as any;
      let authorizedUser: any;
      if (messageMediator?.request) {
        const { result, error } = await messageMediator.request({
          contract: UserMessageContracts.EnsureAccess,
          payload: {
            authorization: event.authorization,
            schemaOAS: event.schemaOAS
          }
        });
        if (error) {
          throw error;
        }
        authorizedUser = result;
      } else {
        authorizedUser = await authService.authorize(event.authorization);
        authService.throwIfUserHasNoAccessToResource(authorizedUser, event.schemaOAS);
      }
      event.authenticatedUser = authorizedUser;
      if (event.metadata) {
        event.metadata.userId = authorizedUser?.id || '';
      }
      return originalMethod.apply(this, [...args]);
    };
    return descriptor;
  };
}

export default Authorize;
