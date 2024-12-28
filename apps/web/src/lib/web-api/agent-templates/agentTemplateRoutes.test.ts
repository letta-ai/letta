/* @jest-environment node */
import { mockDatabase, mockDatabaseInsert } from '@letta-web/database-testing';
import { router } from '$web/web-api/router';
import { lettaAgentAPIMock } from '@letta-web/letta-agents-api-testing';

jest.mock('@letta-web/database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-web/database'),
  db: mockDatabase,
}));

jest.mock('$web/server/auth', () => ({
  __esModule: true,
  ...jest.requireActual('$web/server/auth'),
  getUserWithActiveOrganizationIdOrThrow: jest.fn(() => ({
    activeOrganizationId: '123',
    lettaAgentsId: '456',
  })),
}));

describe('agentTemplateRoutes', () => {
  beforeEach(() => {
    mockDatabase.query.organizationPreferences.findFirst.mockResolvedValue({
      defaultProjectId: '123',
      id: 'test-org-id',
      organizationId: 'test-org-id',
    });
  });

  describe('forkAgentTemplate', () => {
    it('should successfuly fork an agent template (no conflict)', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValueOnce({
        id: 'testing-agent-id',
        name: 'existing-name',
        projectId: '123',
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
        tools: [],
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
          name: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      expect(valuesFn).toHaveBeenCalledWith({
        id: 'new-testing-agent-id',
        name: expect.any(String),
        organizationId: '123',
        projectId: '123',
      });
    });
  });
});
