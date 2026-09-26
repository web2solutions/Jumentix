import sendErrorResponse from '@src/interface/HTTP/adapters/cloudflare-workers/responses/sendErrorResponse';
import { UpdatePasswordRequestEvent } from '@src/modules/Users';

import type {
  CloudflareWorkersRequest,
  CloudflareWorkersResponse
} from '@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { IUpdatePasswordRequest } from '@src/modules/Users';

const updateUserPassword: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/auth/updateUserPassword',
  method: 'post',
  async handler(req: CloudflareWorkersRequest, res: CloudflareWorkersResponse) {
    try {
      if (!controller?.updatePassword) {
        throw new Error(
          'The updateUserPassword endpoint requires a controller implementing updatePassword.'
        );
      }
      const { result, error } = await controller.updatePassword(
        new UpdatePasswordRequestEvent<IUpdatePasswordRequest>({
          authorization: req.headers.authorization ?? '',
          input: req.body as IUpdatePasswordRequest,
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

export default updateUserPassword;
