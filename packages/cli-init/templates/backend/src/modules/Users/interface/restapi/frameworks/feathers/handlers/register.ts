import sendErrorResponse from '@src/interface/HTTP/adapters/feathers/responses/sendErrorResponse';
import { RegisterRequestEvent } from '@src/modules/Users';

import type {
  FeathersRequest,
  FeathersResponse
} from '@src/interface/HTTP/adapters/feathers/FeathersServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { IRegisterRequest } from '@src/modules/Users';

const register: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/auth/register',
  method: 'post',
  async handler(req: FeathersRequest, res: FeathersResponse) {
    try {
      if (!controller?.register) {
        throw new Error('The register endpoint requires a controller implementing register.');
      }
      const { result, error } = await controller.register(
        new RegisterRequestEvent<IRegisterRequest>({
          input: req.body as IRegisterRequest,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(201).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default register;
