import { AuthService } from '@src/modules/Users/service/AuthService';
import { EAuthSchemaType } from '@src/modules/Users/service/ports/EAuthSchemaType';
import { EUserRole } from '@src/modules/Users/domain/security/Rbac';

describe('auth service security audit integration', () => {
  const setup = () => {
    const userProvider = {
      findUser: jest.fn().mockResolvedValue({
        id: 'u1',
        username: 'john',
        password: 'hashed',
        organization: 'org-1',
        roles: [EUserRole.admin]
      }),
      updatePassword: jest.fn().mockResolvedValue({ result: true }),
      register: jest.fn().mockResolvedValue({ result: { id: 'u2' } }),
      update: jest.fn().mockResolvedValue({ result: { id: 'u1' } }),
      delete: jest.fn().mockResolvedValue({ result: true })
    };
    const passwordCryptoService = {
      compare: jest.fn().mockResolvedValue(true),
      hash: jest.fn()
    };
    const jwtService = {
      decodeToken: jest.fn().mockReturnValue({ id: 'u1', username: 'john' }),
      generateToken: jest.fn().mockReturnValue('jwt-token')
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(true) };
    const securityAuditRepository = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new AuthService(
      userProvider as any,
      passwordCryptoService as any,
      jwtService as any,
      undefined,
      eventBus as any,
      securityAuditRepository as any
    );

    return {
      service,
      passwordCryptoService,
      eventBus,
      securityAuditRepository
    };
  };

  it('records login success in audit sink', async () => {
    expect.assertions(2);
    const { service, securityAuditRepository } = setup();
    const response = await service.authenticate('john', 'secret', EAuthSchemaType.Bearer);
    expect(response.result?.Authorization).toContain('Bearer ');
    expect(securityAuditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      name: 'users.auth.login.success',
      outcome: 'success'
    }));
  });

  it('records login failure in audit sink', async () => {
    expect.assertions(2);
    const { service, passwordCryptoService, securityAuditRepository } = setup();
    passwordCryptoService.compare.mockResolvedValueOnce(false);
    const response = await service.authenticate('john', 'invalid', EAuthSchemaType.Bearer);
    expect(response.error?.message).toBe('password does not matches');
    expect(securityAuditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      name: 'users.auth.login.failed',
      outcome: 'failed'
    }));
  });

  it('records privileged scope deny and allow events', async () => {
    expect.assertions(3);
    const { service, securityAuditRepository } = setup();
    expect(() => service.throwIfUserHasNoAccessToResource(
      {
        id: 'u1',
        username: 'john',
        firstName: 'John',
        organization: 'org-1',
        roles: [EUserRole.admin]
      } as any,
      { security: [{ bearerAuth: ['delete_organization'] }] } as any
    )).toThrow('Insufficient permission - user must have the delete_organization role');

    service.throwIfUserHasNoAccessToResource(
      {
        id: 'u1',
        username: 'john',
        firstName: 'John',
        organization: 'org-1',
        roles: [EUserRole.admin]
      } as any,
      { security: [{ bearerAuth: ['read_user'] }] } as any
    );

    await new Promise((resolve) => { setImmediate(resolve); });

    const names = securityAuditRepository.record.mock.calls.map((call: any[]) => call[0]?.name);
    expect(names).toContain('users.authz.scope.denied');
    expect(names).toContain('users.authz.scope.allowed');
  });

  /**
   * Audit publication failing must not change an access decision.
   *
   * Every `publishAuditEvent(...)` call in the authorization path ends in
   * `.catch(() => {})`. That is deliberate — a broken audit sink must not lock
   * users out — but it means six rejection handlers existed that nothing invoked,
   * and the property they encode was never asserted. They were the whole of the
   * function-coverage gap on AuthService.
   *
   * The claim under test is security-relevant in both directions: a denial must
   * still deny when the audit write fails, and an allow must still allow. A
   * `.catch` that accidentally swallowed the throw would turn a denial into an
   * allow, and nothing here would have noticed.
   */
  describe('auth service authorization when the audit sink is failing', () => {
    const failingAudit = () => {
      const { service, securityAuditRepository } = setup();
      securityAuditRepository.record.mockRejectedValue(new Error('audit sink unavailable'));
      return { service, securityAuditRepository };
    };

    const admin = {
      id: 'u1',
      username: 'john',
      firstName: 'John',
      organization: 'org-1',
      roles: [EUserRole.admin]
    };

    it('still denies a missing scope', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(() => service.throwIfUserHasNoAccessToResource(
        admin as any,
        { security: [{ bearerAuth: ['delete_organization'] }] } as any
      )).toThrow('Insufficient permission - user must have the delete_organization role');
    });

    it('still allows a satisfied scope', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(service.throwIfUserHasNoAccessToResource(
        admin as any,
        { security: [{ bearerAuth: ['read_user'] }] } as any
      )).toBe(true);
    });

    it('still rejects a route with no security schema', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(() => service.throwIfUserHasNoAccessToResource(admin as any, {} as any))
        .toThrow('there is no security schema defined');
    });

    it('still rejects a user with no roles', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(() => service.throwIfUserHasNoAccessToResource(
        { ...admin, roles: undefined } as any,
        { security: [{ bearerAuth: ['read_user'] }] } as any
      )).toThrow('user.roles is missing');
    });

    it('still rejects a role that requires an organization when none is set', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(() => service.throwIfUserHasNoAccessToResource(
        { ...admin, organization: undefined } as any,
        { security: [{ bearerAuth: ['read_user'] }] } as any
      )).toThrow('organization is required for this user role');
    });

    it('still lets a superadmin through', () => {
      expect.hasAssertions();
      const { service } = failingAudit();

      expect(service.throwIfUserHasNoAccessToResource(
        { ...admin, roles: [EUserRole.superadmin] } as any,
        { security: [{ bearerAuth: ['delete_organization'] }] } as any
      )).toBe(true);
    });

    it('attempted to record the event even though the sink rejected', async () => {
      expect.hasAssertions();
      // Without this, the suite would pass against a service that stopped
      // auditing altogether — the decisions would still be right and the audit
      // trail would be silently gone.
      const { service, securityAuditRepository } = failingAudit();

      service.throwIfUserHasNoAccessToResource(
        admin as any,
        { security: [{ bearerAuth: ['read_user'] }] } as any
      );
      await Promise.resolve();

      expect(securityAuditRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'users.authz.scope.allowed',
          outcome: 'success',
          payload: expect.objectContaining({ userId: 'u1', username: 'john' })
        })
      );
    });
  });
});
