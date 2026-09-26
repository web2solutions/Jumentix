import type EAuthSchemaType from '@src/modules/Users/service/ports/EAuthSchemaType';
import type { IAuthorizationHeader } from '@src/modules/Users/service/ports/IAuthorizationHeader';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';

/**
 * Authenticate during test seeding and return a ready-to-send Authorization
 * header. `authenticate` answers `IServiceResponse` — `result` is optional by
 * contract — so seeding code must prove it exists instead of asserting it
 * away (no-non-null-assertion, JUM-44).
 */
export default async function authenticateForHeader(
  authService: IAuthService,
  username: string,
  password: string,
  schema: EAuthSchemaType
): Promise<IAuthorizationHeader> {
  const response = await authService.authenticate(username, password, schema);
  if (!response.result) {
    throw new Error(`seed authentication failed for ${username}`);
  }
  return { ...response.result };
}
