import { JwtService } from '@src/infra/jwt/JwtService';

describe('jwt service', () => {
  it('generates and decodes tokens and handles invalid tokens', () => {
    expect.hasAssertions();
    const service = new JwtService('my_secret');
    const token = service.generateToken({
      id: 'u1',
      username: 'john',
      firstName: 'John',
      avatar: 'avatar.png',
      roles: ['user']
    });

    const decoded = service.decodeToken(token);
    expect(decoded?.id).toBe('u1');
    expect(service.decodeToken('invalid-token')).toBeNull();
  });

  it('generates a unique token id for tokens issued to the same user', () => {
    expect.hasAssertions();
    const service = new JwtService('my_secret');
    const user = {
      id: 'u1',
      username: 'john',
      firstName: 'John',
      avatar: 'avatar.png',
      roles: ['user']
    };

    const first = service.decodeToken(service.generateToken(user)) as any;
    const second = service.decodeToken(service.generateToken(user)) as any;

    expect(first.jti).toStrictEqual(expect.stringMatching(/^u1:[0-9a-f-]{36}$/));
    expect(second.jti).toStrictEqual(expect.stringMatching(/^u1:[0-9a-f-]{36}$/));
    expect(first.jti).not.toBe(second.jti);
  });

  it('compiles singleton instance and validates missing secret', () => {
    expect.hasAssertions();
    const first = JwtService.compile();
    const second = JwtService.compile();
    expect(first).toBe(second);
    expect(() => new JwtService('')).toThrow('JWT secret key is not defined');
  });
});
