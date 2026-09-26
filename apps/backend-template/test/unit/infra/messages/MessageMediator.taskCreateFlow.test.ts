import InMemoryMessageMediator from '@src/infra/messages/InMemoryMessageMediator';
import UserMessageContracts from '@src/modules/Users/events/contracts/UserMessageContracts';
import registerUserMessageHandlers from '@src/modules/Users/events/listeners/registerUserMessageHandlers';

describe('message mediator request/response flow for task creation', () => {
  it('authorizes a create-task request via user domain contract without direct coupling', async () => {
    expect.hasAssertions();

    const mediator = InMemoryMessageMediator.compile();
    const authService = {
      authorize: jest.fn().mockResolvedValue({
        id: 'u1',
        username: 'john',
        roles: ['task:create']
      }),
      throwIfUserHasNoAccessToResource: jest.fn()
    };
    registerUserMessageHandlers(mediator, authService as any);

    const createTaskEndpoint = async (authorization: string, input: { title: string }) => {
      const access = await mediator.request({
        contract: UserMessageContracts.EnsureAccess,
        payload: {
          authorization,
          schemaOAS: { security: [{ bearerAuth: ['task:create'] }] }
        }
      });

      return {
        id: 't1',
        ownerId: access.result.id,
        title: input.title
      };
    };

    const task = await createTaskEndpoint('Bearer token', { title: 'Ship message mediator' });

    expect(task).toStrictEqual({
      id: 't1',
      ownerId: 'u1',
      title: 'Ship message mediator'
    });
    expect(authService.authorize).toHaveBeenCalledWith('Bearer token');
    expect(authService.throwIfUserHasNoAccessToResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      expect.objectContaining({ security: expect.any(Array) })
    );
  });
});
