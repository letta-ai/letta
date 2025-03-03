/* @jest-environment node */
import {
  mockDatabase,
  mockDatabaseInsert,
} from '@letta-cloud/service-database-testing';
import { lettaAgentAPIMock } from '@letta-cloud/sdk-core-testing';
import { router } from '../router';
import { ApplicationServices } from '@letta-cloud/service-rbac';

jest.mock('@letta-cloud/service-database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-cloud/service-database'),
  db: mockDatabase,
}));

jest.mock('$web/server/auth', () => ({
  __esModule: true,
  ...jest.requireActual('$web/server/auth'),
  getUserWithActiveOrganizationIdOrThrow: jest.fn(() => ({
    activeOrganizationId: '123',
    lettaAgentsId: '456',
    permissions: new Set([ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES]),
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

      lettaAgentAPIMock.AgentsService.retrieveAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
        tools: [],
        memory: {
          blocks: [],
        },
      });

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        id: 'new-testing-agent-id',
      });

      lettaAgentAPIMock.AgentsService.listAgentSources.mockResolvedValue([]);

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
          projectId: '123',
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
