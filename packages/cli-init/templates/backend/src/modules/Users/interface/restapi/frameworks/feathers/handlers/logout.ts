import sendErrorResponse from '@src/interface/HTTP/adapters/feathers/responses/sendErrorResponse';
import { LogoutRequestEvent } from '@src/modules/Users';

import type {
  FeathersRequest,
  FeathersResponse
} from '@src/interface/HTTP/adapters/feathers/FeathersServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { ILogoutRequest } from '@src/modules/Users';

const logout: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/auth/logout',
  method: 'post',
  async handler(req: FeathersRequest, res: FeathersResponse) {
    try {
      if (!controller?.logout) {
        throw new Error('The logout endpoint requires a controller implementing logout.');
      }
      const { result, error } = await controller.logout(
        new LogoutRequestEvent<ILogoutRequest>({
          authorization: req.headers.authorization ?? '',
          input: req.body as ILogoutRequest,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default logout;
