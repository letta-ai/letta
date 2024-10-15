/*
 * @jest-environment node
 */
import { createAgent } from '$letta/sdk';
import { mockDatabase, mockDatabaseInsert } from '@letta-web/database-testing';
import { AgentRecipeVariant } from '$letta/types';
import { lettaAgentAPIMock } from '@letta-web/letta-agents-api-testing';
import { premadeAgentTemplates } from '$letta/sdk/agents/premadeAgentTemplates';
import * as router from '$letta/web-api/router';

jest.mock('$letta/web-api/router', () => ({
  ...jest.requireActual('$letta/web-api/router'),
  createProject: jest.fn(),
}));

const createProjectSpy = jest.spyOn(router, 'createProject');

describe('agentsRouter', () => {
  describe('createAgent', () => {
    it('should return an error if user is creating an agent with a name with no project id', async () => {
      const response = await createAgent(
        {
          body: {
            name: 'test-agent',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 400,
        body: {
          message: 'project_id is required when providing a name',
        },
      });
    });

    it('should throw an error if user is creating an agent template with a name that already exists in the project', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-agent',
        id: 'test-agent-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAgent(
        {
          body: {
            name: 'test-agent',
            project_id: 'test-project-id',
            template: true,
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 409,
        body: {
          message: 'An agent with the same name already exists',
        },
      });
    });
    //
    it('should throw an error if user is creating an agent with a name that already exists in the project', async () => {
      mockDatabase.query.deployedAgents.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        key: 'test-agent',
        id: 'test-agent-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        internalAgentCountId: 0,
        deployedAgentTemplateId: '',
      });

      const response = await createAgent(
        {
          body: {
            name: 'test-agent',
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 409,
        body: {
          message: 'An agent with the same name already exists',
        },
      });
    });

    it('should return an error if user is creating a agent from a premade template and project_id is not specified', async () => {
      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: AgentRecipeVariant.CUSTOMER_SUPPORT,
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 400,
        body: {
          message:
            'project_id is required when creating an agent from a premade agent template',
        },
      });
    });

    it('should return an error if user is creating a deployed agent from a premade template', async () => {
      const response = await createAgent(
        {
          body: {
            template: false,
            from_template: AgentRecipeVariant.CUSTOMER_SUPPORT,
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 400,
        body: {
          message:
            'Cannot create a deployed agent from a premade agent template',
        },
      });
    });

    it('should create an agent from a premade template', async () => {
      const createdAgent = {
        id: 'test-agent-id',
        name: 'test-agent',
        created_at: new Date().toISOString(),
        system: '',
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
      };

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: AgentRecipeVariant.CUSTOMER_SUPPORT,
            project_id: 'test-project-id',
            name: 'test',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'letta-test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
            name: expect.any(String),
          },
        },
        {
          user_id: 'letta-test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        name: 'test',
        id: 'test-agent-id',
        projectId: 'test-project-id',
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...createdAgent,
          name: 'test',
        },
      });
    });

    it('should throw an error if user is creating an agent from template and template does not exist', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue(undefined);

      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: 'non-existent-template:23',
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 404,
        body: {
          message: 'Template not found',
        },
      });
    });

    it('should throw an error if user is creating an agent from a template and does not provide a template version', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-template',
        id: 'test-template-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAgent(
        {
          body: {
            template: false,
            from_template: 'test-template',
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 400,
        body: {
          message:
            'You can only create a new agent from a specific version of a template or latest. Format <template-name>:<version>',
        },
      });
    });

    it('should throw an error if user is creating an agent from template and template version does not exist', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-template',
        id: 'test-template-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const version = '23';

      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: `test-template:${version}`,
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 404,
        body: {
          message: `${version} of template test-template not found`,
        },
      });
    });

    it('should create an agent from a template', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-template',
        id: 'test-template-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDatabase.query.deployedAgentTemplates.findFirst.mockResolvedValue({
        organizationId: 'test-org-id',
        projectId: 'test-project-id',
        agentTemplateId: 'test-template-id',
        id: 'deployed-test-template-id',
        version: '23',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        system: '',
        memory: {
          ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT].memory,
          memory: {
            ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT].memory
              ?.memory,
            human: {
              ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT]
                .memory?.memory?.human,
              value:
                "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
            },
          },
        },
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'test',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'next-test',
      });

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            template: false,
            from_template: 'test-template:23',
            project_id: 'test-project-id',
            variables: {
              name: 'Timber',
            },
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.getAgent).toHaveBeenCalledWith(
        {
          agentId: 'deployed-test-template-id',
        },
        {
          user_id: 'test-id',
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
            name: expect.any(String),
            memory: {
              ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT]
                .memory,
              memory: {
                ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT]
                  .memory?.memory,
                human: {
                  ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT]
                    .memory?.memory?.human,
                  value:
                    "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is Timber",
                },
              },
            },
          },
        },
        {
          user_id: 'test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        id: 'test-agent-id',
        projectId: 'test-project-id',
        deployedAgentTemplateId: 'deployed-test-template-id',
        key: expect.any(String),
        internalAgentCountId: 1,
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
          agent_type: 'memgpt_agent',
          name: valuesFn.mock.calls[0][0].key,
          id: 'test-agent-id',
        },
      });
    });

    it('should create an agent template from a template', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-template',
        id: 'test-template-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDatabase.query.deployedAgentTemplates.findFirst.mockResolvedValue({
        organizationId: 'test-org-id',
        projectId: 'test-project-id',
        agentTemplateId: 'test-template-id',
        id: 'test-template-id',
        version: '23',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        system: '',
        id: 'test-agent-id',
        name: 'test',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        system: '',
        id: 'test-agent-id',
        name: 'next-test',
      });

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: 'test-template:23',
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.getAgent).toHaveBeenCalledWith(
        {
          agentId: 'test-template-id',
        },
        {
          user_id: 'test-id',
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
            name: expect.any(String),
          },
        },
        {
          user_id: 'test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        id: 'test-agent-id',
        projectId: 'test-project-id',
        deployedAgentTemplateId: 'test-template-id',
        key: expect.any(String),
        internalAgentCountId: 1,
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
          system: '',
          name: valuesFn.mock.calls[0][0].key,
          id: 'test-agent-id',
        },
      });
    });

    it('should create an agent template from a template with no version specified', async () => {
      mockDatabase.query.agentTemplates.findFirst.mockResolvedValue({
        projectId: 'test-project-id',
        name: 'test-template',
        id: 'test-template-id',
        organizationId: 'test-org-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDatabase.query.deployedAgentTemplates.findFirst.mockResolvedValue({
        organizationId: 'test-org-id',
        projectId: 'test-project-id',
        agentTemplateId: 'test-template-id',
        id: 'test-template-id',
        version: '23',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        system: '',
        id: 'test-agent-id',
        name: 'test',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
        system: '',
        id: 'test-agent-id',
        name: 'next-test',
      });

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            template: true,
            from_template: 'test-template',
            project_id: 'test-project-id',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.getAgent).toHaveBeenCalledWith(
        {
          agentId: 'test-template-id',
        },
        {
          user_id: 'test-id',
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
            name: expect.any(String),
          },
        },
        {
          user_id: 'test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        id: 'test-agent-id',
        projectId: 'test-project-id',
        deployedAgentTemplateId: 'test-template-id',
        key: expect.any(String),
        internalAgentCountId: 1,
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
          system: '',
          name: valuesFn.mock.calls[0][0].key,
          id: 'test-agent-id',
        },
      });
    });

    it('should create an agent template', async () => {
      const createdAgent = {
        id: 'test-agent-id',
        name: 'test-agent',
        created_at: new Date().toISOString(),
        system: '',
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
      };

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            template: true,
            project_id: 'test-project-id',
            name: 'test',
            system: 'swag',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'letta-test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            system: 'swag',
            name: expect.any(String),
          },
        },
        {
          user_id: 'letta-test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        name: 'test',
        id: 'test-agent-id',
        projectId: 'test-project-id',
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...createdAgent,
          name: 'test',
        },
      });
    });

    it('should create a deployed agent', async () => {
      const createdAgent = {
        id: 'test-agent-id',
        name: 'test-agent',
        created_at: new Date().toISOString(),
        system: '',
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
      };

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            project_id: 'test-project-id',
            name: 'test',
            system: 'swag',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'letta-test-id',
          },
        }
      );

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            system: 'swag',
            name: expect.any(String),
          },
        },
        {
          user_id: 'letta-test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        key: 'test',
        internalAgentCountId: 0,
        deployedAgentTemplateId: '',
        id: 'test-agent-id',
        projectId: 'test-project-id',
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...createdAgent,
          name: 'test',
        },
      });
    });

    it('should create an agent with no project id', async () => {
      mockDatabase.query.organizationPreferences.findFirst.mockResolvedValue({
        catchAllAgentsProjectId: null,
        id: 'test-org-id',
        organizationId: 'test-org-id',
      });

      const createdAgent = {
        id: 'test-agent-id',
        name: 'test-agent',
        created_at: new Date().toISOString(),
        system: '',
        ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
      };

      createProjectSpy.mockResolvedValue({
        status: 201,
        body: {
          slug: 'new-project-id',
          name: 'new-project',
          id: 'new-project-id',
        },
      });

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn } = mockDatabaseInsert();

      const response = await createAgent(
        {
          body: {
            system: 'swag',
          },
        },
        {
          request: {
            userId: 'test-id',
            organizationId: 'test-org-id',
            lettaAgentsUserId: 'letta-test-id',
          },
        }
      );

      expect(response).toEqual({
        status: 201,
        body: {
          ...createdAgent,
          name: expect.any(String),
        },
      });

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            system: 'swag',
            name: expect.any(String),
          },
        },
        {
          user_id: 'letta-test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        deployedAgentTemplateId: '',
        id: 'test-agent-id',
        key: expect.any(String),
        internalAgentCountId: 0,
        organizationId: 'test-org-id',
        projectId: 'new-project-id',
      });
    });
  });

  it('should create an agent template with no project id', async () => {
    mockDatabase.query.organizationPreferences.findFirst.mockResolvedValue({
      catchAllAgentsProjectId: null,
      id: 'test-org-id',
      organizationId: 'test-org-id',
    });

    const createdAgent = {
      id: 'test-agent-id',
      name: 'test-agent',
      created_at: new Date().toISOString(),
      system: '',
      ...premadeAgentTemplates[AgentRecipeVariant.CUSTOMER_SUPPORT],
    };

    createProjectSpy.mockResolvedValue({
      status: 201,
      body: {
        slug: 'new-project-id',
        name: 'new-project',
        id: 'new-project-id',
      },
    });

    lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(createdAgent);

    const { valuesFn } = mockDatabaseInsert();

    const response = await createAgent(
      {
        body: {
          template: true,
          system: 'swag',
        },
      },
      {
        request: {
          userId: 'test-id',
          organizationId: 'test-org-id',
          lettaAgentsUserId: 'letta-test-id',
        },
      }
    );

    expect(response).toEqual({
      status: 201,
      body: {
        ...createdAgent,
        name: expect.any(String),
      },
    });

    expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
      {
        requestBody: {
          system: 'swag',
          name: expect.any(String),
        },
      },
      {
        user_id: 'letta-test-id',
      }
    );

    expect(valuesFn).toHaveBeenCalledWith({
      organizationId: 'test-org-id',
      projectId: 'new-project-id',
      name: expect.any(String),
      id: 'test-agent-id',
    });
  });
});
