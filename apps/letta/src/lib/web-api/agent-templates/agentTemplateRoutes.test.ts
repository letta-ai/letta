/* @jest-environment node */
import { mockDatabase, mockDatabaseInsert } from '@letta-web/database-testing';
import { router } from '$letta/web-api/router';
import { lettaAgentAPIMock } from '@letta-web/letta-agents-api-testing';

jest.mock('@letta-web/database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-web/database'),
  db: mockDatabase,
}));

jest.mock('$letta/server/auth', () => ({
  __esModule: true,
  ...jest.requireActual('$letta/server/auth'),
  getUserWithActiveOrganizationIdOrThrow: jest.fn(() => ({
    activeOrganizationId: '123',
    lettaAgentsId: '456',
  })),
}));

describe('agentTemplateRoutes', () => {
  describe('forkAgentTemplate', () => {
    it('should successfuly fork an agent template (no conflict)', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValueOnce({
        id: 'testing-agent-id',
        name: 'existing-name',
        projectId: '123',
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
        memory: {
          blocks: [],
        },
      });

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      const { returningFn, valuesFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          id: 'new-testing-agent-id',
          name: 'forked-existing-name',
        },
      ]);

      const response = await router.agentTemplates.forkAgentTemplate({
        params: {
          agentTemplateId: 'testing-agent-id',
        },
      });

      expect(response).toEqual({
        status: 201,
        body: {
          id: 'new-testing-agent-id',
          name: 'forked-existing-name',
          updatedAt: expect.any(String),
        },
      });

      expect(valuesFn).toHaveBeenCalledWith({
        id: 'new-testing-agent-id',
        name: 'forked-existing-name',
        organizationId: '123',
        projectId: '123',
      });
    });

    it('should successfuly fork an agent template (with conflict)', async () => {
      // this means we find a template with the same name since we call agentTemplates twice
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        id: 'testing-agent-id',
        name: 'existing-name',
        projectId: '123',
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
        memory: {
          blocks: [],
        },
      });

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      const { returningFn, valuesFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          id: 'new-testing-agent-id',
          name: 'forked-existing-name',
        },
      ]);

      const response = await router.agentTemplates.forkAgentTemplate({
        params: {
          agentTemplateId: 'testing-agent-id',
        },
      });

      // do not remove this, we use this to make sure we're calling agent templates twice
      // first to get the matching template, second to verify for conflicting names
      expect(mockDatabase.query.agentTemplates.findFirst).toHaveBeenCalledTimes(
        2
      );

      expect(response).toEqual({
        status: 201,
        body: {
          id: 'new-testing-agent-id',
          name: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      expect(valuesFn.mock.calls[0][0].name.split('-')).toEqual([
        'forked',
        'existing',
        'name',
        expect.any(String),
      ]);
    });
  });
});
