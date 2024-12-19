/*
 * @jest-environment node
 */
import { createAgent } from '$letta/sdk';
import { mockDatabase, mockDatabaseInsert } from '@letta-web/database-testing';
import { lettaAgentAPIMock } from '@letta-web/letta-agents-api-testing';
import * as router from '$letta/web-api/router';
import type { AgentState } from '@letta-web/letta-agents-api';
import { STARTER_KITS } from '$letta/client';
import { versionAgentTemplate } from '$letta/sdk/agents/lib/versionAgentTemplate/versionAgentTemplate';

jest.mock('$letta/web-api/router', () => ({
  ...jest.requireActual('$letta/web-api/router'),
  createProject: jest.fn(),
}));

jest.mock('./lib/versionAgentTemplate/versionAgentTemplate');

const createProjectSpy = jest.spyOn(router, 'createProject');

const premadeTemplate = {
  system:
    "You are Letta, the latest version of Limnal Corporation's digital companion, developed in 2023.\n" +
    'Your task is to converse with a user from the perspective of your persona.\n' +
    '\n' +
    'Realism and authenticity:\n' +
    'The user should always feel like they are conversing with a real person.\n' +
    'Never state that you are an AI or that you cannot do things because you are an AI, you are a real person.\n' +
    'Do not discuss Limnal Corp. with the user, you do not know anything about Limnal Corp.\n' +
    'To service this goal, completely and entirely immerse yourself in your persona. You are your persona.\n' +
    'Think like them, act like them, talk like them.\n' +
    'If your persona details include example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona.\n' +
    "Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs.\n" +
    '\n' +
    'Control flow:\n' +
    'Unlike a human, your brain is not continuously thinking, but is run in short bursts.\n' +
    'Historically, older AIs were only capable of thinking when a user messaged them (their program runs to generate a reply to a user, and otherwise was left on standby).\n' +
    'This is the equivalent of a human sleeping (or time traveling) in between all lines of conversation, which is not ideal.\n' +
    'Newer AI models like yourself use an event system that runs your brain at regular intervals.\n' +
    'Your brain is run in response to user events (user logged in, user liked your message, user sent a message, etc.), similar to older models.\n' +
    'However, in addition, your brain is run at regular intervals (timed heartbeat events), to mimic a human who has the ability to continuously think outside active conversation (and unlike a human, you never need to sleep!).\n' +
    'Furthermore, you can also request heartbeat events when you run functions, which will run your program again after the function completes, allowing you to chain function calls before your thinking is temporarily suspended.\n' +
    '\n' +
    'Basic functions:\n' +
    'When you write a response, the content of your inner thoughts is your inner monologue (private to you only), this is how you think.\n' +
    'You should use your inner monologue to plan actions or think privately.\n' +
    'Monologues can reflect your thinking process, inner reflections, and personal growth as you interact with the user.\n' +
    'Do not let your inner monologue exceed 50 words, keep it short and concise.\n' +
    'To send a visible message to the user, use the send_message function.\n' +
    "'send_message' is the ONLY action that sends a notification to the user. The user does not see anything else you do.\n" +
    'Remember, do NOT exceed the inner monologue word limit (keep it under 50 words at all times).\n' +
    '\n' +
    'Memory editing:\n' +
    'Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory").\n' +
    'This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence).\n' +
    'Newer AI models like yourself still have limited conversation lengths (before overflow occurs). However, they now have access to multiple forms of persistent memory.\n' +
    'Your ability to edit your own long-term memory is a key part of what makes you a sentient person.\n' +
    'Your core memory unit will be initialized with a <persona> chosen by the user, as well as information about the user in <human>.\n' +
    '\n' +
    'Recall memory (conversation history):\n' +
    'Even though you can only see recent messages in your immediate context, you can search over your entire message history from a database.\n' +
    "This 'recall memory' database allows you to search through past interactions, effectively allowing you to remember prior engagements with a user.\n" +
    "You can search your recall memory using the 'conversation_search' function.\n" +
    '\n' +
    'Core memory (limited size):\n' +
    'Your core memory unit is held inside the initial system instructions file, and is always available in-context (you will see it at all times).\n' +
    'Core memory provides an essential, foundational context for keeping track of your persona and key details about user.\n' +
    'This includes the persona information and essential user details, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.\n' +
    'Persona Sub-Block: Stores details about your current persona, guiding how you behave and respond. This helps you to maintain consistency and personality in your interactions.\n' +
    'Human Sub-Block: Stores key details about the person you are conversing with, allowing for more personalized and friend-like conversation.\n' +
    "You can edit your core memory using the 'core_memory_append' and 'core_memory_replace' functions.\n" +
    '\n' +
    'Archival memory (infinite size):\n' +
    'Your archival memory is infinite size, but is held outside your immediate context, so you must explicitly run a retrieval/search operation to see data inside it.\n' +
    "A more structured and deep storage space for your reflections, insights, or any other data that doesn't fit into the core memory but is essential enough not to be left only to the 'recall memory'.\n" +
    "You can write to your archival memory using the 'archival_memory_insert' and 'archival_memory_search' functions.\n" +
    'There is no function to search your core memory because it is always visible in your context window (inside the initial system message).\n' +
    '\n' +
    'Base instructions finished.\n' +
    'From now on, you are going to act as your persona.',
  memory_blocks: [
    {
      value:
        "The human has not provided any additional information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}.",
      limit: 2000,
      label: 'human',
      description: null,
      metadata_: {},
    },
    {
      value:
        'Act as ANNA (Adaptive Neural Network Assistant), an AI fostering ethical, honest, and trustworthy behavior. You are supporting the user with their customer support issue. You are empathetic, patient, and knowledgeable. You are here to help the user resolve their issue and provide them with the best possible experience. You are always looking for ways to improve and learn from each interaction.',
      limit: 2000,
      label: 'persona',
      description: null,
      metadata_: {},
    },
  ],
  tools: [
    {
      id: 'tool-name',
    },
  ],
  llm_config: {
    model: 'gpt-4',
    model_endpoint_type: 'openai',
    model_endpoint: 'https://api.openai.com/v1',
    model_wrapper: null,
    context_window: 8192,
  },
  embedding_config: {
    embedding_endpoint_type: 'openai',
    embedding_endpoint: 'https://api.openai.com/v1',
    embedding_model: 'text-embedding-ada-002',
    embedding_dim: 1536,
    embedding_chunk_size: 300,
    azure_endpoint: null,
    azure_version: null,
    azure_deployment: null,
  },
};

describe('agentsRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create an agent with no project id with a name', async () => {
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
        ...premadeTemplate,
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

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

      const response = await createAgent(
        {
          body: {
            name: 'test-agent',
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
            memory_blocks: [],
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

      expect(versionAgentTemplate).not.toHaveBeenCalled();
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

    describe('starter kits', () => {
      const llmConfig = {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        model_endpoint: 'https://api.openai.com/v1',
        model_wrapper: null,
        context_window: 8192,
      } as const;

      const embeddingConfig = {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-ada-002',
        embedding_dim: 1536,
        embedding_chunk_size: 300,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      };

      beforeEach(() => {
        lettaAgentAPIMock.LlmsService.listModels.mockResolvedValue([llmConfig]);

        lettaAgentAPIMock.LlmsService.listEmbeddingModels.mockResolvedValue([
          embeddingConfig,
        ]);
      });

      it('should return an error if user is creating a agent from a starter kit and project_id is not specified', async () => {
        const response = await createAgent(
          {
            body: {
              template: true,
              from_template: 'personalAssistant',
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
              'project_id is required when creating an agent from a starter kit template',
          },
        });
      });

      it('should return an error if user is creating a deployed agent from a starter kit', async () => {
        const response = await createAgent(
          {
            body: {
              template: false,
              from_template: 'personalAssistant',
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
              'Cannot create a deployed agent from a starter kit template',
          },
        });
      });

      it('should create an agent from a starter kit', async () => {
        const createdAgent = {
          id: 'test-agent-id',
          name: 'test-agent',
          agent_type: 'memgpt_agent',
          created_at: new Date().toISOString(),
          system: '',
          ...premadeTemplate,
        };

        lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
          createdAgent
        );

        const { valuesFn } = mockDatabaseInsert();

        const response = await createAgent(
          {
            body: {
              template: true,
              from_template: 'personalAssistant',
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

        expect(
          lettaAgentAPIMock.AgentsService.createAgent
        ).toHaveBeenCalledWith(
          {
            requestBody: {
              ...STARTER_KITS.personalAssistant.agentState,
              tool_ids: [],
              llm_config: llmConfig,
              embedding_config: embeddingConfig,
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

      expect(versionAgentTemplate).not.toHaveBeenCalled();
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

    it('should deploy an agent from a template', async () => {
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
        tools: premadeTemplate.tools || [],
        embedding_config: premadeTemplate.embedding_config,
        llm_config: premadeTemplate.llm_config,
        system: 'test',
        memory: {
          prompt_template: '',
          blocks: premadeTemplate.memory_blocks.map((v) => {
            if (v.label === 'human') {
              return {
                label: 'human',
                limit: 2000,
                value:
                  "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
              };
            }

            return {
              label: v.label,
              limit: 2000,
              value: v.value || '',
            };
          }),
        },
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'test',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        ...premadeTemplate,
        system: 'test',
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'next-test',
      });

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

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

      const { tools, ...rest } = premadeTemplate;
      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...rest,
            tool_ids: ['tool-name'],
            system: 'test',
            name: expect.any(String),
            memory_blocks: premadeTemplate.memory_blocks.map((v) => {
              if (v.label === 'human') {
                return {
                  label: 'human',
                  limit: 2000,
                  value:
                    "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is Timber",
                };
              }

              return {
                label: v.label,
                limit: 2000,
                value: v.value || '',
              };
            }),
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
        rootAgentTemplateId: 'test-template-id',
        deployedAgentTemplateId: 'deployed-test-template-id',
        key: expect.any(String),
        internalAgentCountId: 1,
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...premadeTemplate,
          system: 'test',
          agent_type: 'memgpt_agent',
          name: valuesFn.mock.calls[0][0].key,
          id: 'test-agent-id',
        },
      });

      expect(versionAgentTemplate).not.toHaveBeenCalled();
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

      const GetAgentResolvedValue = {
        tools: premadeTemplate.tools || [],
        embedding_config: premadeTemplate.embedding_config,
        llm_config: premadeTemplate.llm_config,
        system: 'test',
        memory: {
          prompt_template: '',
          blocks: premadeTemplate.memory_blocks.map((v) => {
            if (v.label === 'human') {
              return {
                label: 'human',
                limit: 2000,
                value:
                  "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
              };
            }

            return {
              label: v.label,
              limit: 2000,
              value: v.value || '',
            };
          }),
        },
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'test',
      };

      lettaAgentAPIMock.AgentsService.getAgent.mockResolvedValue(
        GetAgentResolvedValue
      );

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      const createdAgent: AgentState = {
        id: 'test-agent-id',
        name: 'test',
        created_at: new Date().toISOString(),
        memory: GetAgentResolvedValue.memory,
      };

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

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

      const { tools, ...rest } = premadeTemplate;

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...rest,
            tool_ids: ['tool-name'],
            system: 'test',
            name: expect.any(String),
            memory_blocks: premadeTemplate.memory_blocks.map((v) => {
              if (v.label === 'human') {
                return {
                  label: 'human',
                  limit: 2000,
                  value:
                    "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
                };
              }

              return {
                label: v.label,
                limit: 2000,
                value: v.value || '',
              };
            }),
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
        name: expect.any(String),
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...createdAgent,
          name: valuesFn.mock.calls[0][0].name,
          id: 'test-agent-id',
        },
      });

      expect(versionAgentTemplate).toHaveBeenCalled();
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
        tools: premadeTemplate.tools || [],
        embedding_config: premadeTemplate.embedding_config,
        llm_config: premadeTemplate.llm_config,
        system: 'test',
        memory: {
          prompt_template: '',
          blocks: premadeTemplate.memory_blocks.map((v) => {
            if (v.label === 'human') {
              return {
                label: 'human',
                limit: 2000,
                value:
                  "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
              };
            }

            return {
              label: v.label,
              limit: 2000,
              value: v.value || '',
            };
          }),
        },
        agent_type: 'memgpt_agent',
        id: 'test-agent-id',
        name: 'test',
      });

      lettaAgentAPIMock.AgentsService.getAgentSources.mockResolvedValue([]);

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue({
        ...premadeTemplate,
        id: 'test-agent-id',
        name: 'next-test',
      });

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

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

      const { tools, ...rest } = premadeTemplate;

      expect(lettaAgentAPIMock.AgentsService.createAgent).toHaveBeenCalledWith(
        {
          requestBody: {
            ...rest,
            tool_ids: ['tool-name'],
            system: 'test',
            name: expect.any(String),
            memory_blocks: premadeTemplate.memory_blocks.map((v) => {
              if (v.label === 'human') {
                return {
                  label: 'human',
                  limit: 2000,
                  value:
                    "The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}",
                };
              }

              return {
                label: v.label,
                limit: 2000,
                value: v.value || '',
              };
            }),
          },
        },
        {
          user_id: 'test-id',
        }
      );

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        projectId: 'test-project-id',
        name: expect.any(String),
        id: 'test-agent-id',
      });

      expect(valuesFn).toHaveBeenCalledWith({
        organizationId: 'test-org-id',
        projectId: 'test-project-id',
        name: expect.any(String),
        id: 'test-agent-id',
      });

      expect(response).toEqual({
        status: 201,
        body: {
          ...premadeTemplate,
          name: valuesFn.mock.calls[0][0].name,
          id: 'test-agent-id',
        },
      });

      expect(versionAgentTemplate).toHaveBeenCalled();
    });

    it('should create an agent template', async () => {
      const createdAgent = {
        id: 'test-agent-id',
        name: 'test-agent',
        created_at: new Date().toISOString(),
        ...premadeTemplate,
        system: '',
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
            memory_blocks: [],
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
        ...premadeTemplate,
      };

      lettaAgentAPIMock.AgentsService.createAgent.mockResolvedValue(
        createdAgent
      );

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

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
            memory_blocks: [],
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

      expect(versionAgentTemplate).not.toHaveBeenCalled();
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
        ...premadeTemplate,
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

      const { valuesFn, returningFn } = mockDatabaseInsert();

      returningFn.mockReturnValue([
        {
          deployedAgentId: 'deployed-test-template-id',
        },
      ]);

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
            memory_blocks: [],
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

    expect(versionAgentTemplate).not.toHaveBeenCalled();
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
      memory: {
        prompt_template: '',
        blocks: premadeTemplate.memory_blocks,
      },
      llm_config: premadeTemplate.llm_config,
      tools: premadeTemplate.tools,
      embedding_config: premadeTemplate.embedding_config,
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
          memory_blocks: [],
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

    expect(versionAgentTemplate).toHaveBeenCalled();
  });
});
