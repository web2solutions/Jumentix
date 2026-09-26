import { randomUUID } from 'node:crypto';

import { sign, verify } from 'jsonwebtoken';

import { JWT_TOKEN_EXPIRES_IN, JWT_TOKEN_SECRET_KEY } from '@src/config/jwt';
import NotImplemented from '@src/infra/exceptions/NotImplemented';
import { readProductEnv } from '@src/interface/runtime/RuntimeEnvironment';

import type { SignOptions, VerifyOptions } from 'jsonwebtoken';

import type { IJwtService } from '@src/infra/jwt/IJwtService';
import type { ITokenObject } from '@src/modules/Users/service/ports/ITokenObject';

let jwtService: any;

class JwtService implements IJwtService {
  private secret: string;

  public expiresIn: number;

  constructor(secret = JWT_TOKEN_SECRET_KEY) {
    if (!secret) throw new NotImplemented('JWT secret key is not defined');
    this.secret = secret;
    this.expiresIn = JWT_TOKEN_EXPIRES_IN;
  }

  public decodeToken(token: string): ITokenObject | null {
    // console.log('+++++++  decodeToken() SECRET', this.secret);
    let valid = null;
    try {
      const verifyOptions: VerifyOptions = {};
      const jwtIssuer = readProductEnv(process.env, 'JUMENTIX_JWT_ISSUER');
      if (jwtIssuer) {
        verifyOptions.issuer = jwtIssuer;
      }
      const jwtAudience = readProductEnv(process.env, 'JUMENTIX_JWT_AUDIENCE');
      if (jwtAudience) {
        verifyOptions.audience = jwtAudience;
      }
      valid = verify(token, this.secret, verifyOptions) as ITokenObject;
    } catch (error) {
      valid = null;
    }
    return valid;
  }

  public generateToken(data: Record<any, any>): string {
    const { id, username, firstName, avatar, organization, roles } = data;
    const signOptions: SignOptions = { expiresIn: this.expiresIn };
    const jwtIssuer = readProductEnv(process.env, 'JUMENTIX_JWT_ISSUER');
    if (jwtIssuer) {
      signOptions.issuer = jwtIssuer;
    }
    const jwtAudience = readProductEnv(process.env, 'JUMENTIX_JWT_AUDIENCE');
    if (jwtAudience) {
      signOptions.audience = jwtAudience;
    }
    const token = sign(
      {
        jti: `${id || username || 'anonymous'}:${randomUUID()}`,
        id,
        username,
        firstName,
        avatar,
        organization,
        roles
      },
      this.secret,
      signOptions
    );
    return token;
  }

  public static compile() {
    if (jwtService) return jwtService;
    jwtService = new JwtService();
    return jwtService;
  }
}

export default JwtService;
