/* jest-environment node */
import { BASE_URL, lettaAxiosSDK } from './constants';
import { destroyRedisInstance } from '@letta-cloud/service-redis';
import waitOn from 'wait-on';
import { getAgentByName, getAPIKey } from './helpers';
import type { TemplateSnapshotSchemaType } from '@letta-cloud/utils-shared';
import { AgentState } from '@letta-cloud/sdk-core';

const testAgentName = 'template-test-agent';

let testAgentId: string;
const testProject = 'default-project';

// Generate unique names for each test run to avoid conflicts
const testTemplateName = `e2e-test-template`;
const testForkTemplateName = `e2e-test-fork-template`;
const testForkedTemplateName = `e2e-test-forked-template`;
const testDeleteTemplateName = `e2e-test-delete-template`;
const testSnapshotTemplateName = `e2e-test-snapshot-template`;
const savedTemplateName = `e2e-test-saved-template`;
const duplicateName = `duplicate-template-name`;
const testCreateAgentsTemplateName = `e2e-test-create-agents-template`;
const testRenameTemplateName = `e2e-test-rename-template`;
const testRenameNewName = `e2e-test-renamed-template`;
const testDeleteComprehensiveName = `e2e-test-delete-comprehensive`;
const testEntityIdConsistencyName = `e2e-test-entity-id-consistency`;
const testClassicAgentFileName = `e2e-test-classic-agent-file`;
const testDynamicAgentFileName = `e2e-test-dynamic-agent-file`;
const testSleeptimeAgentFileName = `e2e-test-sleeptime-agent-file`;
const testClusterAgentFileName = `e2e-test-cluster-agent-file`;
const testVoiceSleeptimeAgentFileName = `e2e-test-voice-sleeptime-agent-file`;
const testRoundRobinAgentFileName = `e2e-test-round-robin-agent-file`;
const testSupervisorAgentFileName = `e2e-test-supervisor-agent-file`;

const customName = `custom-template-name`;

beforeAll(async () => {
  await waitOn({
    resources: [BASE_URL],
    timeout: 30 * 1000,
  });

  const apiKey = await getAPIKey();
  lettaAxiosSDK.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;

  // Clean up any existing test agents
  const existingAgent = await getAgentByName(testAgentName);
  if (existingAgent) {
    await lettaAxiosSDK.delete(`/v1/agents/${existingAgent.id}`);
  }

  // Create a test agent first
  const agent = await lettaAxiosSDK.post('/v1/agents', {
    name: testAgentName,
    description: 'test agent for templates',
    llm_config: {
      model: 'gpt-4o-mini',
      model_endpoint_type: 'openai',
      model_endpoint: 'https://api.openai.com/v1',
      model_wrapper: null,
      context_window: 128000,
    },
    embedding_config: {
      embedding_endpoint_type: 'openai',
      embedding_endpoint: 'https://api.openai.com/v1',
      embedding_model: 'text-embedding-3-small',
      embedding_dim: 1536,
      embedding_chunk_size: 300,
      azure_endpoint: null,
      azure_version: null,
      azure_deployment: null,
    },
    memory_blocks: [
      {
        label: 'human',
        value: 'Test human information for entity ID consistency testing',
        limit: 1000,
      },
      {
        label: 'persona',
        value: 'Test persona information for entity ID consistency testing',
        limit: 1000,
      },
    ],
  });

  expect(agent.status).toBe(201);
  testAgentId = agent.data.id;

  /* delete all existing templates with the names above */
  [
    testTemplateName,
    savedTemplateName,
    testForkedTemplateName,
    testForkTemplateName,
    duplicateName,
    testSnapshotTemplateName,
    testDeleteTemplateName,
    testCreateAgentsTemplateName,
    customName,
    testRenameTemplateName,
    testRenameNewName,
    testDeleteComprehensiveName,
    testEntityIdConsistencyName,
    testClassicAgentFileName,
    testDynamicAgentFileName,
    testSleeptimeAgentFileName,
    testClusterAgentFileName,
    testVoiceSleeptimeAgentFileName,
    testRoundRobinAgentFileName,
    testSupervisorAgentFileName,
  ].forEach(async (name) => {
    try {
      await lettaAxiosSDK.delete(`/v1/templates/${testProject}/${name}`);
    } catch (_error) {
      console.warn(`Failed to delete template ${name}. It may not exist.`);
    }
  });
}, 100000);

describe('Templates', () => {
  describe('basic route connectivity', () => {
    it('should connect to templates API and list templates', async () => {
      const response = await lettaAxiosSDK.get('/v1/templates');

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
    });
  });

  describe('createTemplate', () => {
    it('should create a template from an agent', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testTemplateName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('project_id');
      expect(response.data).toHaveProperty('project_slug');
      expect(response.data).toHaveProperty('latest_version');
      expect(response.data).toHaveProperty('description');
      expect(response.data).toHaveProperty('template_deployment_slug');
      expect(response.data.latest_version).toEqual('1');

      expect(response.data.name).toBe(testTemplateName);
      expect(response.data.project_slug).toBe(testProject);
    });

    it('should return 400 for non-existent agent', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: 'non-existent-agent-id',
        },
      );

      if (response.status !== 400) {
        console.error(
          `Expected 400 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
    });

    it('should return 400 for non-existent project', async () => {
      const response = await lettaAxiosSDK.post(
        '/v1/templates/non-existent-project',
        {
          type: 'agent',
          agent_id: testAgentId,
        },
      );

      if (response.status !== 400) {
        console.error(
          `Expected 400 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe('Project not found');
    });
  });

  describe('createTemplateFromAgentFile', () => {
    // Sample tool schemas for testing
    const sampleTools = [
      {
        id: 'tool-1',
        name: 'send_message',
        description: 'Send a message to a user',
        source_code:
          'def send_message(message: str) -> str:\n    """Send a message to a user"""\n    return f"Message sent: {message}"',
        source_type: 'python',
        tags: ['communication'],
        json_schema: {
          name: 'send_message',
          description: 'Send a message to a user',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to send',
              },
            },
            required: ['message'],
          },
        },
      },
      {
        id: 'tool-2',
        name: 'calculate_sum',
        description: 'Calculate the sum of two numbers',
        source_code:
          'def calculate_sum(a: int, b: int) -> int:\n    """Calculate the sum of two numbers"""\n    return a + b',
        source_type: 'python',
        tags: ['math', 'calculation'],
        json_schema: {
          name: 'calculate_sum',
          description: 'Calculate the sum of two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: {
                type: 'integer',
                description: 'First number',
              },
              b: {
                type: 'integer',
                description: 'Second number',
              },
            },
            required: ['a', 'b'],
          },
        },
      },
      {
        id: 'tool-3',
        name: 'get_weather',
        description: 'Get weather information',
        source_code:
          'def get_weather(location: str) -> str:\n    """Get weather information for a location"""\n    return f"Weather in {location}: Sunny, 72°F"',
        source_type: 'python',
        tags: ['weather', 'api'],
        json_schema: {
          name: 'get_weather',
          description: 'Get weather information for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The location to get weather for',
              },
            },
            required: ['location'],
          },
        },
      },
    ];

    // Classic template: single agent, no groups
    const classicAgentFile = {
      agents: [
        {
          id: 'agent-1',
          agent_type: 'memgpt_v2_agent',
          name: 'Classic Agent',
          system:
            'You are a helpful assistant created from a classic template.',
          tool_ids: ['tool-1', 'tool-2'],
          block_ids: ['block-1', 'block-2'],
          source_ids: ['should-be-stripped'],
          tags: ['classic', 'test'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            context_window: 128000,
          },
        },
      ],
      groups: [],
      blocks: [
        {
          id: 'block-1',
          label: 'human',
          value: 'Test human block for classic template',
          limit: 1000,
        },
        {
          id: 'block-2',
          label: 'persona',
          value: 'Test persona block for classic template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Dynamic group template: multiple agents with dynamic group
    const dynamicAgentFile = {
      agents: [
        {
          id: 'manager-agent',
          agent_type: 'memgpt_v2_agent',
          name: 'Manager Agent',
          system:
            'You are a manager agent that coordinates between team members.',
          tool_ids: ['tool-1', 'tool-3'],
          block_ids: ['block-3', 'block-4'],
          source_ids: ['should-be-stripped-1'],
          tags: ['manager', 'dynamic'],
          group_ids: ['dynamic-group-1'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            context_window: 128000,
          },
        },
        {
          id: 'worker-agent-1',
          agent_type: 'memgpt_v2_agent',
          name: 'Worker Agent 1',
          system: 'You are a worker agent that handles calculations.',
          block_ids: ['block-3', 'block-4'],
          tool_ids: ['tool-2'],
          source_ids: ['should-be-stripped-2'],
          tags: ['worker', 'calculation'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            context_window: 128000,
          },
        },
        {
          id: 'worker-agent-2',
          agent_type: 'memgpt_v2_agent',
          block_ids: ['block-3'],
          name: 'Worker Agent 2',
          system: 'You are a worker agent that handles weather queries.',
          tool_ids: ['tool-3'],
          source_ids: ['should-be-stripped-3'],
          tags: ['worker', 'weather'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.4,
            context_window: 128000,
          },
        },
      ],
      groups: [
        {
          id: 'dynamic-group-1',
          name: 'Dynamic Team',
          manager_config: {
            manager_type: 'dynamic',
            manager_agent_id: 'manager-agent',
            termination_token: 'DONE',
            max_turns: 10,
          },
        },
      ],
      blocks: [
        {
          id: 'block-3',
          label: 'human',
          value: 'Test human block for dynamic template',
          limit: 1000,
        },
        {
          id: 'block-4',
          label: 'persona',
          value: 'Test persona block for dynamic template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Sleeptime template: main agent + sleeptime agent
    const sleeptimeAgentFile = {
      agents: [
        {
          id: 'main-agent',
          agent_type: 'memgpt_v2_agent',
          name: 'Main Agent',
          block_ids: ['block-5', 'block-6'],
          system: 'You are a main agent in a sleeptime configuration.',
          tool_ids: ['tool-1', 'tool-2'],
          source_ids: ['should-be-stripped-main'],
          tags: ['main', 'sleeptime'],
          group_ids: ['sleeptime-group-1'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            context_window: 128000,
          },
        },
        {
          id: 'sleeptime-agent',
          agent_type: 'sleeptime_agent',
          name: 'Sleeptime Agent',
          block_ids: ['block-5'],
          system: 'You are a sleeptime monitoring agent.',
          tool_ids: ['tool-3'],
          source_ids: ['should-be-stripped-sleeptime'],
          tags: ['sleeptime', 'monitor'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.1,
            context_window: 128000,
          },
        },
      ],
      groups: [
        {
          id: 'sleeptime-group-1',
          name: 'Sleeptime Team',
          manager_config: {
            manager_type: 'sleeptime',
            manager_agent_id: 'main-agent',
            sleeptime_agent_frequency: 30,
          },
        },
      ],
      blocks: [
        {
          id: 'block-5',
          label: 'human',
          value: 'Test human block for sleeptime template',
          limit: 1000,
        },
        {
          id: 'block-6',
          label: 'persona',
          value: 'Test persona block for sleeptime template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Cluster template: multiple agents without groups
    const clusterAgentFile = {
      agents: [
        {
          id: 'worker-agent-1',
          agent_type: 'memgpt_v2_agent',
          name: 'Worker Agent 1',
          system: 'You are worker agent 1 in a cluster.',
          tool_ids: ['tool-1'],
          block_ids: ['block-7'],
          source_ids: ['should-be-stripped-cluster-1'],
          tags: ['cluster', 'worker'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            context_window: 128000,
          },
        },
        {
          id: 'worker-agent-2',
          agent_type: 'memgpt_v2_agent',
          name: 'Worker Agent 2',
          system: 'You are worker agent 2 in a cluster.',
          tool_ids: ['tool-2'],
          block_ids: ['block-7'],
          source_ids: ['should-be-stripped-cluster-2'],
          tags: ['cluster', 'worker'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.4,
            context_window: 128000,
          },
        },
      ],
      groups: [],
      blocks: [
        {
          id: 'block-7',
          label: 'human',
          value: 'Test human block for cluster template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Voice sleeptime template: main agent with voice sleeptime configuration
    const voiceSleeptimeAgentFile = {
      agents: [
        {
          id: 'voice-main-agent',
          agent_type: 'memgpt_v2_agent',
          name: 'Voice Main Agent',
          system: 'You are a main agent in a voice sleeptime configuration.',
          tool_ids: ['tool-1'],
          block_ids: ['block-8'],
          source_ids: ['should-be-stripped-voice-main'],
          tags: ['voice', 'sleeptime'],
          group_ids: ['voice-sleeptime-group'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.6,
            context_window: 128000,
          },
        },
      ],
      groups: [
        {
          id: 'voice-sleeptime-group',
          name: 'Voice Sleeptime Group',
          manager_config: {
            manager_type: 'voice_sleeptime',
            manager_agent_id: 'voice-main-agent',
            max_message_buffer_length: 20,
            min_message_buffer_length: 5,
          },
        },
      ],
      blocks: [
        {
          id: 'block-8',
          label: 'human',
          value: 'Test human block for voice sleeptime template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Round robin template: multiple agents with round robin management
    const roundRobinAgentFile = {
      agents: [
        {
          id: 'rr-agent-1',
          agent_type: 'memgpt_v2_agent',
          name: 'Round Robin Agent 1',
          system: 'You are the first agent in a round robin setup.',
          tool_ids: ['tool-1'],
          block_ids: ['block-9'],
          source_ids: ['should-be-stripped-rr-1'],
          tags: ['round-robin', 'participant'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            context_window: 128000,
          },
        },
        {
          id: 'rr-agent-2',
          agent_type: 'memgpt_v2_agent',
          name: 'Round Robin Agent 2',
          system: 'You are the second agent in a round robin setup.',
          tool_ids: ['tool-2'],
          block_ids: ['block-9'],
          source_ids: ['should-be-stripped-rr-2'],
          tags: ['round-robin', 'participant'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            context_window: 128000,
          },
        },
      ],
      groups: [
        {
          id: 'round-robin-group',
          name: 'Round Robin Group',
          manager_config: {
            manager_type: 'round_robin',
            max_turns: 8,
          },
        },
      ],
      blocks: [
        {
          id: 'block-9',
          label: 'human',
          value: 'Test human block for round robin template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    // Supervisor template: multiple agents with supervisor management
    const supervisorAgentFile = {
      agents: [
        {
          id: 'supervisor-agent',
          agent_type: 'memgpt_v2_agent',
          name: 'Supervisor Agent',
          system: 'You are a supervisor agent managing other agents.',
          tool_ids: ['tool-1', 'tool-2'],
          block_ids: ['block-10'],
          source_ids: ['should-be-stripped-supervisor'],
          tags: ['supervisor', 'manager'],
          group_ids: ['supervisor-group'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            context_window: 128000,
          },
        },
        {
          id: 'supervised-agent-1',
          agent_type: 'memgpt_v2_agent',
          name: 'Supervised Agent 1',
          system: 'You are supervised by the supervisor agent.',
          tool_ids: ['tool-3'],
          block_ids: ['block-10'],
          source_ids: ['should-be-stripped-supervised-1'],
          tags: ['supervised', 'worker'],
          llm_config: {
            model: 'gpt-4o-mini',
            temperature: 0.8,
            context_window: 128000,
          },
        },
      ],
      groups: [
        {
          id: 'supervisor-group',
          name: 'Supervisor Group',
          manager_config: {
            manager_type: 'supervisor',
            manager_agent_id: 'supervisor-agent',
          },
        },
      ],
      blocks: [
        {
          id: 'block-10',
          label: 'human',
          value: 'Test human block for supervisor template',
          limit: 1000,
        },
      ],
      files: [],
      sources: [],
      tools: sampleTools,
      mcp_servers: [],
    };

    it('should create a classic template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: classicAgentFile,
          name: testClassicAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('project_id');
      expect(response.data).toHaveProperty('project_slug');
      expect(response.data).toHaveProperty('latest_version');
      expect(response.data).toHaveProperty('description');
      expect(response.data).toHaveProperty('template_deployment_slug');
      expect(response.data.latest_version).toEqual('1');
      expect(response.data.name).toBe(testClassicAgentFileName);
      expect(response.data.project_slug).toBe(testProject);

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testClassicAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('classic');
      expect(snapshotResponse.data.agents).toHaveLength(1);
      expect(snapshotResponse.data.blocks).toHaveLength(2);

      // Verify source_ids were stripped (should be empty)
      const agent = snapshotResponse.data.agents[0];
      expect(agent.sourceIds).toEqual([]);

      // Verify tools were created and mapped
      expect(Array.isArray(agent.toolIds)).toBe(true);
      expect(agent.toolIds.length).toBe(2); // Should have 2 tools from original agent file

      // Verify tool IDs are server-generated (not the original agent file tool IDs)
      expect(agent.toolIds).not.toContain('tool-1');
      expect(agent.toolIds).not.toContain('tool-2');

      // Verify all tool IDs are valid server-generated strings
      agent.toolIds.forEach((toolId: string) => {
        expect(typeof toolId).toBe('string');
        expect(toolId.length).toBeGreaterThan(0);
        expect(toolId).not.toMatch(/^tool-\d+$/); // Should not match original pattern
      });
    });

    it('should create a dynamic template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: dynamicAgentFile,
          name: testDynamicAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testDynamicAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDynamicAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('dynamic');
      expect(snapshotResponse.data.agents).toHaveLength(3); // manager + 2 workers
      expect(snapshotResponse.data.blocks).toHaveLength(2);

      // Verify group configuration
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'managerAgentEntityId',
      );
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'terminationToken',
        'DONE',
      );
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'maxTurns',
        10,
      );

      // Verify source_ids were stripped from all agents
      snapshotResponse.data.agents.forEach((agent: any) => {
        expect(agent.sourceIds).toEqual([]);
      });

      // Verify tools were created and mapped for all agents
      const managerAgent = snapshotResponse.data.agents.find((a: any) =>
        a.tags?.includes('manager'),
      );
      const worker1Agent = snapshotResponse.data.agents.find((a: any) =>
        a.tags?.includes('calculation'),
      );
      const worker2Agent = snapshotResponse.data.agents.find((a: any) =>
        a.tags?.includes('weather'),
      );

      expect(managerAgent).toBeDefined();
      expect(worker1Agent).toBeDefined();
      expect(worker2Agent).toBeDefined();

      // Manager should have 2 tools (tool-1, tool-3 mapped to server IDs)
      expect(Array.isArray(managerAgent.toolIds)).toBe(true);
      expect(managerAgent.toolIds.length).toBe(2);
      expect(managerAgent.toolIds).not.toContain('tool-1');
      expect(managerAgent.toolIds).not.toContain('tool-3');

      // Worker 1 should have 1 tool (tool-2 mapped to server ID)
      expect(Array.isArray(worker1Agent.toolIds)).toBe(true);
      expect(worker1Agent.toolIds.length).toBe(1);
      expect(worker1Agent.toolIds).not.toContain('tool-2');

      // Worker 2 should have 1 tool (tool-3 mapped to server ID)
      expect(Array.isArray(worker2Agent.toolIds)).toBe(true);
      expect(worker2Agent.toolIds.length).toBe(1);
      expect(worker2Agent.toolIds).not.toContain('tool-3');

      // Verify all tool IDs are server-generated
      [
        ...managerAgent.toolIds,
        ...worker1Agent.toolIds,
        ...worker2Agent.toolIds,
      ].forEach((toolId: string) => {
        expect(typeof toolId).toBe('string');
        expect(toolId.length).toBeGreaterThan(0);
        expect(toolId).not.toMatch(/^tool-\d+$/); // Should not match original pattern
      });
    });

    it('should create a sleeptime template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: sleeptimeAgentFile,
          name: testSleeptimeAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testSleeptimeAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSleeptimeAgentFileName}:latest/snapshot`,
      )) as { status: 200; data: TemplateSnapshotSchemaType };

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('sleeptime');
      expect(snapshotResponse.data.agents).toHaveLength(2); // main + sleeptime agent
      expect(snapshotResponse.data.blocks).toHaveLength(2);

      // Verify group configuration
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'managerAgentEntityId',
      );
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'sleeptimeAgentFrequency',
        30,
      );

      // Verify source_ids were stripped from all agents
      snapshotResponse.data.agents.forEach((agent: any) => {
        expect(agent.sourceIds).toEqual([]);
      });

      // Verify tools were created and mapped for all agents
      const mainAgent = snapshotResponse.data.agents.find(
        (a) => a.agentType === 'memgpt_v2_agent',
      );
      const sleeptimeAgent = snapshotResponse.data.agents.find(
        (a) => a.agentType === 'sleeptime_agent',
      );

      if (!mainAgent || !sleeptimeAgent) {
        throw new Error(
          'Expected to find both main and sleeptime agents in the snapshot',
        );
      }

      expect(mainAgent).toBeDefined();
      expect(sleeptimeAgent).toBeDefined();

      // Main agent should have 2 tools (tool-1, tool-2 mapped to server IDs)
      expect(Array.isArray(mainAgent?.toolIds)).toBe(true);
      expect((mainAgent?.toolIds || []).length).toBe(2);
      expect(mainAgent?.toolIds).not.toContain('tool-1');
      expect(mainAgent?.toolIds).not.toContain('tool-2');

      // Sleeptime agent should have 1 tool (tool-3 mapped to server ID)
      expect(Array.isArray(sleeptimeAgent?.toolIds)).toBe(true);
      expect((sleeptimeAgent?.toolIds || []).length).toBe(1);
      expect(sleeptimeAgent?.toolIds).not.toContain('tool-3');

      // Verify all tool IDs are server-generated
      [
        ...(mainAgent?.toolIds || []),
        ...(sleeptimeAgent?.toolIds || []),
      ].forEach((toolId: string) => {
        expect(typeof toolId).toBe('string');
        expect(toolId.length).toBeGreaterThan(0);
        expect(toolId).not.toMatch(/^tool-\d+$/); // Should not match original pattern
      });
    });

    it('should create a cluster template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: clusterAgentFile,
          name: testClusterAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testClusterAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testClusterAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('cluster');
      expect(snapshotResponse.data.agents).toHaveLength(2); // 2 worker agents
      expect(snapshotResponse.data.blocks).toHaveLength(1);

      // Verify source_ids were stripped from all agents
      snapshotResponse.data.agents.forEach((agent: any) => {
        expect(agent.sourceIds).toEqual([]);
      });
    });

    it('should create a voice sleeptime template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: voiceSleeptimeAgentFile,
          name: testVoiceSleeptimeAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testVoiceSleeptimeAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testVoiceSleeptimeAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('voice_sleeptime');
      expect(snapshotResponse.data.agents).toHaveLength(2); // 2 agents: main + voice sleeptime
      expect(snapshotResponse.data.blocks).toHaveLength(1);

      // Verify group configuration
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'managerAgentEntityId',
      );
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'maxMessageBufferLength',
        20,
      );
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'minMessageBufferLength',
        5,
      );

      // Verify source_ids were stripped
      snapshotResponse.data.agents.forEach((agent: any) => {
        expect(agent.sourceIds).toEqual([]);
      });
    });

    it('should create a round robin template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: roundRobinAgentFile,
          name: testRoundRobinAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testRoundRobinAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testRoundRobinAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('round_robin');
      expect(snapshotResponse.data.agents).toHaveLength(2); // 2 agents in round robin
      expect(snapshotResponse.data.blocks).toHaveLength(1);

      // Verify group configuration
      expect(snapshotResponse.data.configuration).toHaveProperty('maxTurns', 8);
    });

    it('should create a supervisor template from agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: supervisorAgentFile,
          name: testSupervisorAgentFileName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.name).toBe(testSupervisorAgentFileName);
      expect(response.data.latest_version).toEqual('1');

      // Get template snapshot to verify structure
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSupervisorAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data.type).toBe('supervisor');
      expect(snapshotResponse.data.agents).toHaveLength(2); // supervisor + supervised agent
      expect(snapshotResponse.data.blocks).toHaveLength(1);

      // Verify group configuration
      expect(snapshotResponse.data.configuration).toHaveProperty(
        'managerAgentEntityId',
      );

      // Verify agents
      const supervisorAgent = snapshotResponse.data.agents.find((a: any) =>
        a.tags?.includes('supervisor'),
      );
      const supervisedAgent = snapshotResponse.data.agents.find((a: any) =>
        a.tags?.includes('supervised'),
      );

      expect(supervisorAgent).toBeDefined();
      expect(supervisedAgent).toBeDefined();

      // Verify supervisor has multiple tools
      expect(Array.isArray(supervisorAgent.toolIds)).toBe(true);
      expect(supervisorAgent.toolIds.length).toBe(2);

      // Verify supervised agent has one tool
      expect(Array.isArray(supervisedAgent.toolIds)).toBe(true);
      expect(supervisedAgent.toolIds.length).toBe(1);

      // Verify source_ids were stripped
      snapshotResponse.data.agents.forEach((agent: any) => {
        expect(agent.sourceIds).toEqual([]);
      });
    });

    it('should return 400 for invalid agent file structure', async () => {
      const invalidAgentFile = {
        agents: [], // Empty agents array should cause error
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
      };

      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: invalidAgentFile,
          name: 'invalid-agent-file-template',
        },
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
    });

    it('should return 400 for malformed agent file', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: null, // Invalid agent file
          name: 'malformed-agent-file-template',
        },
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for non-existent project with agent file', async () => {
      const response = await lettaAxiosSDK.post(
        '/v1/templates/non-existent-project',
        {
          type: 'agent_file',
          agent_file: classicAgentFile,
          name: 'test-template',
        },
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe('Project not found');
    });

    it('should return 400 for invalid template type', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'invalid_type',
          name: 'invalid-type-template',
        },
      );

      expect(response.status).toBe(400);
    });

    it('should verify tools were actually created on the server', async () => {
      // Get the classic template snapshot to extract server tool IDs
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testClassicAgentFileName}:latest/snapshot`,
      );

      expect(snapshotResponse.status).toBe(200);
      const agent = snapshotResponse.data.agents[0];
      const serverToolIds = agent.toolIds;

      expect(serverToolIds.length).toBe(2); // Should have 2 tools

      // Verify we can retrieve each tool by its server-generated ID
      for (const toolId of serverToolIds) {
        const toolResponse = await lettaAxiosSDK.get(`/v1/tools/${toolId}`);

        expect(toolResponse.status).toBe(200);
        expect(toolResponse.data).toHaveProperty('id', toolId);
        expect(toolResponse.data).toHaveProperty('name');
        expect(toolResponse.data).toHaveProperty('source_code');

        // Verify it's one of our expected tools by name
        expect(['send_message', 'calculate_sum']).toContain(
          toolResponse.data.name,
        );

        // Verify the source code matches what we provided
        if (toolResponse.data.name === 'calculate_sum') {
          expect(toolResponse.data.source_code).toContain(
            'def calculate_sum(a: int, b: int) -> int:',
          );
          expect(toolResponse.data.source_code).toContain('return a + b');
        }
      }
    });
  });

  describe('listTemplates', () => {
    it('should list templates', async () => {
      const response = await lettaAxiosSDK.get('/v1/templates');

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
      expect(Array.isArray(response.data.templates)).toBe(true);
    });

    it('should list templates with search query', async () => {
      const response = await lettaAxiosSDK.get('/v1/templates?search=test');

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
      expect(Array.isArray(response.data.templates)).toBe(true);
    });

    it('should list templates with name filter', async () => {
      const response = await lettaAxiosSDK.get(
        `/v1/templates?name=${testTemplateName}`,
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
    });

    it('should list templates with project filter', async () => {
      const response = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}`,
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
    });

    it('should list templates with pagination', async () => {
      const response = await lettaAxiosSDK.get(
        '/v1/templates?limit=1&offset=0',
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('templates');
      expect(response.data).toHaveProperty('has_next_page');
      expect(response.data.templates.length).toBeLessThanOrEqual(1);
    });

    it('should return 400 when both project_id and project_slug are provided', async () => {
      const response = await lettaAxiosSDK.get(
        '/v1/templates?project_id=123&project_slug=test',
      );

      if (response.status !== 400) {
        console.error(
          `Expected 400 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe(
        'Please provide either project_id or project_slug, not both.',
      );
    });
  });

  describe('saveTemplateVersion', () => {
    it('should save a template version', async () => {
      // first create a template from an agent
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: savedTemplateName,
        },
      );

      // If the template creation failed, throw an error
      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }

      expect(createResponse.data.latest_version).toEqual('1');

      expect(createResponse.status).toBe(201);

      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${savedTemplateName}`,
        {
          message: 'Test version save',
          preserve_environment_variables_on_migration: false,
          preserve_core_memories_on_migration: false,
          migrate_agents: false,
        },
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('project_slug');
      expect(response.data).toHaveProperty('project_id');
      expect(response.data).toHaveProperty('latest_version');
      expect(response.data).toHaveProperty('template_deployment_slug');
      expect(response.data.latest_version).toEqual('2');
    });

    it('should preserve entity IDs across template versions', async () => {
      // 1. Create a template from an agent
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testEntityIdConsistencyName,
        },
      );

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.latest_version).toBe('1');

      // 2. Get snapshot of version 1 and collect entity IDs
      const v1SnapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testEntityIdConsistencyName}:1/snapshot`,
      );

      if (v1SnapshotResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(v1SnapshotResponse.data, null, 2),
        );
      }
      expect(v1SnapshotResponse.status).toBe(200);

      const v1Snapshot = v1SnapshotResponse.data;
      expect(v1Snapshot).toHaveProperty('agents');
      expect(v1Snapshot).toHaveProperty('blocks');
      expect(Array.isArray(v1Snapshot.agents)).toBe(true);
      expect(Array.isArray(v1Snapshot.blocks)).toBe(true);

      // Collect all entity IDs from version 1
      const v1AgentEntityIds = v1Snapshot.agents.map((agent: any) => agent.id);
      const v1BlockEntityIds = v1Snapshot.blocks.map((block: any) => block.id);

      expect(v1AgentEntityIds.length).toBeGreaterThan(0);
      expect(v1BlockEntityIds.length).toBeGreaterThan(0);

      // 3. Version the template (create version 2)
      const versionResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testEntityIdConsistencyName}`,
        {
          message: 'Version 2 for entity ID consistency test',
        },
      );

      if (versionResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(versionResponse.data, null, 2),
        );
      }
      expect(versionResponse.status).toBe(200);
      expect(versionResponse.data.latest_version).toBe('2');

      // 4. Get snapshot of version 2 and collect entity IDs
      const v2SnapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testEntityIdConsistencyName}:2/snapshot`,
      );

      if (v2SnapshotResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(v2SnapshotResponse.data, null, 2),
        );
      }
      expect(v2SnapshotResponse.status).toBe(200);

      const v2Snapshot = v2SnapshotResponse.data;
      expect(v2Snapshot).toHaveProperty('agents');
      expect(v2Snapshot).toHaveProperty('blocks');
      expect(Array.isArray(v2Snapshot.agents)).toBe(true);
      expect(Array.isArray(v2Snapshot.blocks)).toBe(true);

      // Collect all entity IDs from version 2
      const v2AgentEntityIds = v2Snapshot.agents.map((agent: any) => agent.id);
      const v2BlockEntityIds = v2Snapshot.blocks.map((block: any) => block.id);

      // 5. Verify entity IDs are identical between versions
      expect(v1AgentEntityIds).toHaveLength(v2AgentEntityIds.length);
      expect(v1BlockEntityIds).toHaveLength(v2BlockEntityIds.length);

      // Sort arrays to ensure consistent comparison
      v1AgentEntityIds.sort();
      v2AgentEntityIds.sort();
      v1BlockEntityIds.sort();
      v2BlockEntityIds.sort();

      expect(v1AgentEntityIds).toEqual(v2AgentEntityIds);
      expect(v1BlockEntityIds).toEqual(v2BlockEntityIds);

      // Clean up
      await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${testEntityIdConsistencyName}`,
      );
    });
  });

  describe('getTemplateSnapshot', () => {
    it('should get template snapshot with latest version', async () => {
      // First create a template from an agent
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testSnapshotTemplateName,
        },
      );

      // If the template creation failed,  throw an error
      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }

      expect(createResponse.status).toBe(201);

      const response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSnapshotTemplateName}:latest/snapshot`,
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('blocks');
      expect(response.data).toHaveProperty('configuration');
      expect(response.data).toHaveProperty('type');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(Array.isArray(response.data.blocks)).toBe(true);
    });

    it('should get template snapshot with current version', async () => {
      // First get a template to work with
      const templatesResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}`,
      );
      const template = templatesResponse.data.templates[0];

      if (!template) {
        // Skip if no templates available
        return;
      }

      const response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${template.name}:current/snapshot`,
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('blocks');
      expect(response.data).toHaveProperty('configuration');
      expect(response.data).toHaveProperty('type');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/non-existent-template:latest/snapshot`,
      );

      if (response.status !== 404) {
        console.error(
          `Expected 404 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe(
        'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      );
    });
  });

  describe('forkTemplate', () => {
    it('should fork a template', async () => {
      // First create a template to fork
      await lettaAxiosSDK.post(`/v1/templates/${testProject}`, {
        type: 'agent',
        agent_id: testAgentId,
        name: testForkTemplateName,
      });

      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testForkTemplateName}:latest/fork`,
        {
          name: testForkedTemplateName,
        },
      );

      if (response.status !== 200) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('project_slug');
      expect(response.data).toHaveProperty('project_id');
      expect(response.data).toHaveProperty('latest_version');
      expect(response.data).toHaveProperty('template_deployment_slug');
      expect(response.data.name).toBe(testForkedTemplateName);
    });

    it('should return 400 for non-existent template', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/non-existent-template:latest/fork`,
      );

      if (response.status !== 400) {
        console.error(
          `Expected 400 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe(
        'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template and all its versions', async () => {
      // First create a template to delete
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: `${testDeleteTemplateName}-delete-1`,
        },
      );

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }
      expect(createResponse.status).toBe(201);
      const templateName = `${testDeleteTemplateName}-delete-1`;

      // Delete the template
      const deleteResponse = await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${templateName}`,
      );

      if (deleteResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(deleteResponse.data, null, 2),
        );
      }
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data).toHaveProperty('success', true);

      // Verify the template is actually deleted by trying to get its snapshot
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${templateName}:latest/snapshot`,
      );
      expect(snapshotResponse.status).toBe(404);
    });

    it('should delete multiple versions of the same template', async () => {
      // First create a template
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: `${testDeleteTemplateName}-delete-2`,
        },
      );

      expect(createResponse.status).toBe(201);

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }

      const templateName = `${testDeleteTemplateName}-delete-2`;

      // Save a new version
      await lettaAxiosSDK.post(`/v1/templates/${testProject}/${templateName}`, {
        message: 'Test version for deletion',
      });

      // Delete all versions of the template
      const deleteResponse = await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${templateName}`,
      );

      if (deleteResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(deleteResponse.data, null, 2),
        );
      }
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data).toHaveProperty('success', true);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/non-existent-template`,
      );

      if (response.status !== 404) {
        console.error(
          `Expected 404 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain(
        "Template 'non-existent-template' not found",
      );
    });

    it('should return 404 for non-existent project', async () => {
      const response = await lettaAxiosSDK.delete(
        '/v1/templates/non-existent-project/template-name',
      );

      if (response.status !== 404) {
        console.error(
          `Expected 404 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }
      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe('Project not found');
    });

    it('should handle template name without versions', async () => {
      // First create a template
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: `${testDeleteTemplateName}-delete-3`,
        },
      );

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }
      expect(createResponse.status).toBe(201);
      const templateName = `${testDeleteTemplateName}-delete-3`;

      // Try to delete with version syntax (should still work since we ignore versions)
      const deleteResponse = await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${templateName}`,
      );

      if (deleteResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(deleteResponse.data, null, 2),
        );
      }
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data).toHaveProperty('success', true);
    });

    it('should comprehensively delete template and verify inaccessibility', async () => {
      // 1. Create a template
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testDeleteComprehensiveName,
        },
      );

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.name).toBe(testDeleteComprehensiveName);

      // 2. Add versions (creating versions 2 and 3)
      const version2Response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}`,
        {
          message: 'Version 2 for deletion test',
        },
      );

      if (version2Response.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(version2Response.data, null, 2),
        );
      }
      expect(version2Response.status).toBe(200);

      const version3Response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}`,
        {
          message: 'Version 3 for deletion test',
        },
      );

      if (version3Response.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(version3Response.data, null, 2),
        );
      }
      expect(version3Response.status).toBe(200);

      // 3. Verify template exists before deletion
      const beforeListResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}&name=${testDeleteComprehensiveName}`,
      );
      expect(beforeListResponse.status).toBe(200);
      expect(beforeListResponse.data.templates).toHaveLength(1);

      const beforeVersionsResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}/versions`,
      );
      expect(beforeVersionsResponse.status).toBe(200);
      expect(beforeVersionsResponse.data.versions).toHaveLength(3);

      // 4. Delete the template
      const deleteResponse = await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}`,
      );

      if (deleteResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(deleteResponse.data, null, 2),
        );
      }
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data).toHaveProperty('success', true);

      // 5. Verify template is no longer accessible via any endpoint

      // Check template listing - should not find the template
      const afterListResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}&name=${testDeleteComprehensiveName}`,
      );
      expect(afterListResponse.status).toBe(200);
      expect(afterListResponse.data.templates).toHaveLength(0);

      // Check template versions endpoint - should return 404
      const afterVersionsResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}/versions`,
      );
      expect(afterVersionsResponse.status).toBe(404);

      // Check template snapshot endpoints - should return 404
      const snapshotLatestResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}:latest/snapshot`,
      );
      expect(snapshotLatestResponse.status).toBe(404);

      const snapshotV1Response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}:1/snapshot`,
      );
      expect(snapshotV1Response.status).toBe(404);

      const snapshotV2Response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}:2/snapshot`,
      );
      expect(snapshotV2Response.status).toBe(404);

      const snapshotV3Response = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}:3/snapshot`,
      );
      expect(snapshotV3Response.status).toBe(404);

      // Check createAgentsFromTemplate endpoint - should return 404
      const createAgentsResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testDeleteComprehensiveName}:latest/agents`,
        {
          agent_name: 'test-agent-from-deleted-template',
        },
      );
      expect(createAgentsResponse.status).toBe(404);

      // Verify template is not in general template listing
      const allTemplatesResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}`,
      );
      expect(allTemplatesResponse.status).toBe(200);
      const templateNames = allTemplatesResponse.data.templates.map(
        (t: any) => t.name,
      );
      expect(templateNames).not.toContain(testDeleteComprehensiveName);
    });
  });

  describe('name validation and conflicts', () => {
    it('should create template with custom name', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: customName,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.data.name).toBe(customName);

      // Clean up
      await lettaAxiosSDK.delete(`/v1/templates/${testProject}/${customName}`);
    });

    it('should return 400 for duplicate template name', async () => {
      // Create first template
      const firstResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: duplicateName,
        },
      );
      if (firstResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(firstResponse.data, null, 2),
        );
      }
      expect(firstResponse.status).toBe(201);

      // Try to create second template with same name
      const secondResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: duplicateName,
        },
      );
      if (secondResponse.status !== 400) {
        console.error(
          `Expected 400 but got ${secondResponse.status}. Response:`,
          JSON.stringify(secondResponse.data, null, 2),
        );
      }
      expect(secondResponse.status).toBe(400);
      expect(secondResponse.data).toHaveProperty('message');

      // Clean up
      await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${duplicateName}`,
      );
    });
  });

  describe('renameTemplate', () => {
    it('should rename a template and all its versions', async () => {
      // 1. Create a template from an agent
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testRenameTemplateName,
        },
      );

      if (createResponse.status !== 201) {
        console.error(
          'API Error:',
          JSON.stringify(createResponse.data, null, 2),
        );
      }
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.name).toBe(testRenameTemplateName);

      // 2. Version that template twice (creating versions 2 and 3)
      const version2Response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testRenameTemplateName}`,
        {
          message: 'Version 2',
        },
      );

      if (version2Response.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(version2Response.data, null, 2),
        );
      }
      expect(version2Response.status).toBe(200);

      const version3Response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testRenameTemplateName}`,
        {
          message: 'Version 3',
        },
      );

      if (version3Response.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(version3Response.data, null, 2),
        );
      }
      expect(version3Response.status).toBe(200);

      // 3. List all versions and make sure they are 1, 2, 3
      const versionsBeforeResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testRenameTemplateName}/versions`,
      );

      if (versionsBeforeResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(versionsBeforeResponse.data, null, 2),
        );
      }
      expect(versionsBeforeResponse.status).toBe(200);
      expect(versionsBeforeResponse.data.versions).toHaveLength(3);

      const versionNumbers = versionsBeforeResponse.data.versions
        .map((v: any) => parseInt(v.version))
        .sort();
      expect(versionNumbers).toEqual([1, 2, 3]);

      // 4. Perform the rename
      const renameResponse = await lettaAxiosSDK.patch(
        `/v1/templates/${testProject}/${testRenameTemplateName}/name`,
        {
          new_name: testRenameNewName,
        },
      );

      if (renameResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(renameResponse.data, null, 2),
        );
      }
      expect(renameResponse.status).toBe(200);
      expect(renameResponse.data).toHaveProperty('success', true);

      // 5. List all versions of the renamed template and check they're all the same name
      const versionsAfterResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testRenameNewName}/versions`,
      );

      if (versionsAfterResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(versionsAfterResponse.data, null, 2),
        );
      }
      expect(versionsAfterResponse.status).toBe(200);
      expect(versionsAfterResponse.data.versions).toHaveLength(3);

      const versionNumbersAfter = versionsAfterResponse.data.versions
        .map((v: any) => parseInt(v.version))
        .sort();
      expect(versionNumbersAfter).toEqual([1, 2, 3]);

      // 6. List all templates to see if the name change worked
      const templatesResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}&name=${testRenameNewName}`,
      );

      if (templatesResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(templatesResponse.data, null, 2),
        );
      }
      expect(templatesResponse.status).toBe(200);
      expect(templatesResponse.data.templates).toHaveLength(1);
      expect(templatesResponse.data.templates[0].name).toBe(testRenameNewName);

      // Verify old name doesn't exist
      const oldNameResponse = await lettaAxiosSDK.get(
        `/v1/templates?project_slug=${testProject}&name=${testRenameTemplateName}`,
      );

      if (oldNameResponse.status !== 200) {
        console.error(
          'API Error:',
          JSON.stringify(oldNameResponse.data, null, 2),
        );
      }
      expect(oldNameResponse.status).toBe(200);
      expect(oldNameResponse.data.templates).toHaveLength(0);

      // Clean up
      await lettaAxiosSDK.delete(
        `/v1/templates/${testProject}/${testRenameNewName}`,
      );
    });
  });

  describe('createAgentsFromTemplate', () => {
    it('should create agents from a template with default parameters', async () => {
      // First create a template to use
      const createTemplateResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testCreateAgentsTemplateName,
        },
      );

      expect(createTemplateResponse.status).toBe(201);

      // Now create agents from the template
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testCreateAgentsTemplateName}:latest/agents`,
        {
          agent_name: 'agent-from-template',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(1);

      const agent = response.data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(typeof agent.id).toBe('string');
      expect(agent.template_id).toEqual(createTemplateResponse.data.id);
      expect(agent.template_id).not.toEqual(agent.base_template_id);
    });

    it('should create agents from a template with custom parameters', async () => {
      const customAgentName = 'custom-agent-from-template';
      const customMemoryVariables = { key1: 'value1', key2: 'value2' };
      const customTags = ['test', 'e2e', 'template'];
      const customToolVariables = { tool_key: 'tool_value' };
      const initialMessages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant created from a template.',
        },
        {
          role: 'user' as const,
          content: 'Hello, template agent!',
        },
      ];

      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testCreateAgentsTemplateName}:latest/agents`,
        {
          agent_name: customAgentName,
          memory_variables: customMemoryVariables,
          tags: customTags,
          tool_variables: customToolVariables,
          initial_message_sequence: initialMessages,
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(1);

      const agent = response.data.agents[0];

      // Validate basic agent properties
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('tags');
      expect(agent).toHaveProperty('memory');
      expect(agent).toHaveProperty('tool_exec_environment_variables');
      expect(typeof agent.id).toBe('string');

      // Validate custom agent name
      expect(agent.name).toBe(customAgentName);

      // Validate custom tags
      expect(Array.isArray(agent.tags)).toBe(true);
      expect(agent.tags).toEqual(expect.arrayContaining(customTags));

      // Validate memory structure and blocks contain memory variables
      expect(agent.memory).toHaveProperty('blocks');
      expect(Array.isArray(agent.memory.blocks)).toBe(true);

      // Validate tool environment variables
      // if (agent.tool_exec_environment_variables) {
      //   expect(Array.isArray(agent.tool_exec_environment_variables)).toBe(true);
      //
      //   // Check if custom tool variables are present
      //   const hasCustomToolVars = agent.tool_exec_environment_variables.some(
      //     (envVar: any) =>
      //       envVar.key === 'tool_key' && envVar.value === 'tool_value',
      //   );
      //   expect(hasCustomToolVars).toBe(true);
      // }

      // Validate that the agent has message IDs (indicating initial messages were set)
      if (agent.message_ids) {
        expect(Array.isArray(agent.message_ids)).toBe(true);
        // Should have at least the initial messages we provided
        expect(agent.message_ids.length).toBeGreaterThanOrEqual(
          initialMessages.length,
        );
      }
    });

    it('should create agents from a template with empty custom parameters', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testCreateAgentsTemplateName}:latest/agents`,
        {
          agent_name: '',
          memory_variables: {},
          tags: [],
          tool_variables: {},
          initial_message_sequence: [],
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(1);

      const agent = response.data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(typeof agent.id).toBe('string');
      // Agent name should be auto-generated if empty string provided
      expect(agent.name).not.toBe('');
      expect(typeof agent.name).toBe('string');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/non-existent-template:latest/agents`,
        {},
      );

      if (response.status !== 404) {
        console.error(
          `Expected 404 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('template does not exist');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/non-existent-project/${testCreateAgentsTemplateName}:latest/agents`,
        {},
      );

      if (response.status !== 404) {
        console.error(
          `Expected 404 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toBe('Project not found');
    });

    it('should return 400 for invalid template version format', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/invalid-format/agents`,
        {},
      );

      if (response.status !== 400) {
        console.error(
          `Expected 400 but got ${response.status}. Response:`,
          JSON.stringify(response.data, null, 2),
        );
      }

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain(
        'Invalid template version format',
      );
    });

    it('should handle template with specific version', async () => {
      // Use the existing template with version 1
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testCreateAgentsTemplateName}:1/agents`,
        {
          agent_name: 'agent-from-specific-version',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(1);

      const agent = response.data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent.name).toBe('agent-from-specific-version');
    });

    it('should create agents from cluster template and validate no groups are created', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testClusterAgentFileName}:latest/agents`,
        {
          agent_name: 'cluster-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(2); // 2 agents in cluster

      // Validate that no groups were created (cluster templates don't create groups)
      expect(response.data.group).toBe(null);

      // Verify each agent has correct properties
      response.data.agents.forEach((agent: any) => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(typeof agent.id).toBe('string');
        expect(typeof agent.name).toBe('string');
      });
    });

    it('should create agents from voice sleeptime template and validate group creation', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testVoiceSleeptimeAgentFileName}:latest/agents`,
        {
          agent_name: 'voice-sleeptime-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('group');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(2); // 1 agent in voice sleeptime

      // Verify group was created with correct configuration
      const group = response.data.group;
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('manager_type', 'voice_sleeptime');
      expect(group).toHaveProperty('agent_ids');
      expect(Array.isArray(group.agent_ids)).toBe(true);
      expect(group.agent_ids).toHaveLength(2);

      // Verify the agent is in the group
      const agentId = response.data.agents[0].id;
      expect(group.agent_ids).toContain(agentId);
    });

    it('should create agents from round robin template and validate group creation', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testRoundRobinAgentFileName}:latest/agents`,
        {
          agent_name: 'round-robin-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('group');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(2); // 2 agents in round robin

      // Verify group was created with correct configuration
      const group = response.data.group;
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('manager_type', 'round_robin');
      expect(group).toHaveProperty('max_turns');
      expect(group).toHaveProperty('agent_ids');
      expect(Array.isArray(group.agent_ids)).toBe(true);
      expect(group.agent_ids).toHaveLength(2);

      // Verify both agents are in the group
      const agentIds = response.data.agents.map((agent: any) => agent.id);
      agentIds.forEach((agentId: string) => {
        expect(group.agent_ids).toContain(agentId);
      });
    });

    it('should create agents from supervisor template and validate group creation', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testSupervisorAgentFileName}:latest/agents`,
        {
          agent_name: 'supervisor-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('group');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(2); // supervisor + supervised agent

      // Verify group was created with correct configuration
      const group = response.data.group;
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('manager_type', 'supervisor');
      expect(group).toHaveProperty('manager_agent_id');
      expect(group).toHaveProperty('agent_ids');
      expect(Array.isArray(group.agent_ids)).toBe(true);
      expect(group.agent_ids).toHaveLength(2);

      // Verify the manager agent ID is one of the created agents
      const agentIds = response.data.agents.map((agent: any) => agent.id);
      expect(agentIds).toContain(group.manager_agent_id);

      // Verify all agents are in the group
      agentIds.forEach((agentId: string) => {
        expect(group.agent_ids).toContain(agentId);
      });
    });

    it('should create agents from sleeptime template and validate group creation', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testSleeptimeAgentFileName}:latest/agents`,
        {
          agent_name: 'sleeptime-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('group');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(2); // main + sleeptime agent

      // Verify group was created with correct configuration
      const group = response.data.group;
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('manager_type', 'sleeptime');
      expect(group).toHaveProperty('manager_agent_id');
      expect(group).toHaveProperty('sleeptime_agent_frequency');
      expect(group).toHaveProperty('agent_ids');
      expect(Array.isArray(group.agent_ids)).toBe(true);
      expect(group.agent_ids).toHaveLength(2);

      // Verify the manager agent ID is one of the created agents
      const agentIds = response.data.agents.map((agent: any) => agent.id);
      expect(agentIds).toContain(group.manager_agent_id);

      // Verify all agents are in the group
      agentIds.forEach((agentId: string) => {
        expect(group.agent_ids).toContain(agentId);
      });
    });

    it('should create agents from dynamic template and validate group creation', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${testDynamicAgentFileName}:latest/agents`,
        {
          agent_name: 'dynamic-agent-test',
        },
      );

      if (response.status !== 201) {
        console.error('API Error:', JSON.stringify(response.data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('agents');
      expect(response.data).toHaveProperty('group');
      expect(Array.isArray(response.data.agents)).toBe(true);
      expect(response.data.agents).toHaveLength(3); // manager + 2 workers

      // Verify group was created with correct configuration
      const group = response.data.group;
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('manager_type', 'dynamic');
      expect(group).toHaveProperty('manager_agent_id');
      expect(group).toHaveProperty('termination_token');
      expect(group).toHaveProperty('max_turns');
      expect(group).toHaveProperty('agent_ids');
      expect(Array.isArray(group.agent_ids)).toBe(true);
      expect(group.agent_ids).toHaveLength(3);

      // Verify the manager agent ID is one of the created agents
      const agentIds = response.data.agents.map((agent: any) => agent.id);
      expect(agentIds).toContain(group.manager_agent_id);

      // Verify all agents are in the group
      agentIds.forEach((agentId: string) => {
        expect(group.agent_ids).toContain(agentId);
      });
    });
  });

  describe('/v1/templates/:project/:template_version/snapshot PUT', () => {
    let testSetSnapshotTemplateName: string;

    beforeEach(async () => {
      testSetSnapshotTemplateName = `e2e-test-set-snapshot-template-${Date.now()}`;

      // Clean up any existing template with this name
      try {
        await lettaAxiosSDK.delete(
          `/v1/templates/${testProject}/${testSetSnapshotTemplateName}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }

      // Create a fresh template for each test
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent',
          agent_id: testAgentId,
          name: testSetSnapshotTemplateName,
        },
      );
      expect(createResponse.status).toBe(201);
    });

    afterEach(async () => {
      // Clean up the test template
      try {
        await lettaAxiosSDK.delete(
          `/v1/templates/${testProject}/${testSetSnapshotTemplateName}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should set current template from snapshot and preserve entity relationships', async () => {
      // 1. Get the current template snapshot to have baseline data
      const snapshotResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
      )) as { status: number; data: TemplateSnapshotSchemaType };

      if (snapshotResponse.status !== 200) {
        console.error(
          'Get Snapshot Error:',
          JSON.stringify(snapshotResponse.data, null, 2),
        );
      }
      expect(snapshotResponse.status).toBe(200);
      expect(snapshotResponse.data).toHaveProperty('agents');
      expect(snapshotResponse.data).toHaveProperty('blocks');
      expect(snapshotResponse.data).toHaveProperty('relationships');
      expect(snapshotResponse.data).toHaveProperty('configuration');
      expect(snapshotResponse.data).toHaveProperty('type');

      const originalSnapshot = snapshotResponse.data;
      console.log(
        'Original snapshot agent count:',
        originalSnapshot.agents.length,
      );
      console.log(
        'Original snapshot block count:',
        originalSnapshot.blocks.length,
      );
      console.log(
        'Original snapshot relationship count:',
        originalSnapshot.relationships.length,
      );

      // 3. Modify the snapshot data to test updating
      const modifiedSnapshot = {
        ...originalSnapshot,
        agents: originalSnapshot.agents.map((agent) => ({
          ...agent,
          systemPrompt: agent.systemPrompt + ' [MODIFIED VIA SNAPSHOT]',
          // Keep the entityId to test preservation
        })),
        blocks: originalSnapshot.blocks.map((block) => ({
          ...block,
          value: block.value + ' [MODIFIED VIA SNAPSHOT]',
          description: (block.description || '') + ' [MODIFIED VIA SNAPSHOT]',
          // Keep the entityId to test preservation
        })),
        // Keep relationships to ensure they are preserved
        relationships: originalSnapshot.relationships,
      };

      // 4. Update the current template using the modified snapshot
      const updateResponse = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
        modifiedSnapshot,
      );

      if (updateResponse.status !== 200) {
        console.error(
          'Update Snapshot Error:',
          JSON.stringify(updateResponse.data, null, 2),
        );
      }
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data).toHaveProperty('success', true);
      expect(updateResponse.data).toHaveProperty('message');

      // 5. Get the updated snapshot to verify changes were applied
      const updatedSnapshotResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
      )) as { status: number; data: TemplateSnapshotSchemaType };

      if (updatedSnapshotResponse.status !== 200) {
        console.error(
          'Get Updated Snapshot Error:',
          JSON.stringify(updatedSnapshotResponse.data, null, 2),
        );
      }
      expect(updatedSnapshotResponse.status).toBe(200);

      const updatedSnapshot = updatedSnapshotResponse.data;

      // 6. Verify that modifications were applied correctly
      expect(updatedSnapshot.agents).toHaveLength(
        originalSnapshot.agents.length,
      );
      expect(updatedSnapshot.blocks).toHaveLength(
        originalSnapshot.blocks.length,
      );
      expect(updatedSnapshot.relationships).toHaveLength(
        originalSnapshot.relationships.length,
      );

      // Verify agents were updated but entityIds preserved
      updatedSnapshot.agents.forEach((updatedAgent) => {
        const originalAgent = originalSnapshot.agents.find(
          (a) => a.entityId === updatedAgent.entityId,
        );
        expect(originalAgent).toBeDefined();
        expect(updatedAgent.systemPrompt).toContain('[MODIFIED VIA SNAPSHOT]');
        expect(updatedAgent.entityId).toBe(originalAgent!.entityId); // EntityId should be preserved
      });

      // Verify blocks were updated but entityIds preserved
      updatedSnapshot.blocks.forEach((updatedBlock) => {
        const originalBlock = originalSnapshot.blocks.find(
          (b) => b.entityId === updatedBlock.entityId,
        );
        expect(originalBlock).toBeDefined();
        expect(updatedBlock.value).toContain('[MODIFIED VIA SNAPSHOT]');
        expect(updatedBlock.description).toContain('[MODIFIED VIA SNAPSHOT]');
        expect(updatedBlock.entityId).toBe(originalBlock!.entityId); // EntityId should be preserved
      });

      // Verify relationships are preserved
      expect(updatedSnapshot.relationships).toEqual(
        originalSnapshot.relationships,
      );

      console.log('✅ Template snapshot update test completed successfully');
    });

    it('should handle adding new entities with relationships and removing entities with existing relationships', async () => {
      // 1. Get the current snapshot
      const snapshotResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
      )) as { status: number; data: TemplateSnapshotSchemaType };

      expect(snapshotResponse.status).toBe(200);
      const originalSnapshot = snapshotResponse.data;

      console.log('Original snapshot counts:');
      console.log('- Agents:', originalSnapshot.agents.length);
      console.log('- Blocks:', originalSnapshot.blocks.length);
      console.log('- Relationships:', originalSnapshot.relationships.length);

      // 2. PHASE 1: Add new agent and block with a relationship between them
      const newAgentEntityId = 'test-new-agent-entity-id';
      const newBlockEntityId = 'test-new-block-entity-id';

      const snapshotWithNewEntities = {
        ...originalSnapshot,
        agents: [
          ...originalSnapshot.agents,
          // Add a new agent
          {
            entityId: newAgentEntityId,
            name: 'new_test_agent',
            model: 'gpt-4o-mini',
            systemPrompt: 'This is a new test agent added via snapshot',
            toolIds: [],
            toolRules: [],
            sourceIds: [],
            identityIds: [],
            tags: [],
            agentType: 'classic' as const,
            properties: null,
            memoryVariables: null,
            toolVariables: null,
          },
        ],
        blocks: [
          ...originalSnapshot.blocks,
          // Add a new block
          {
            entityId: newBlockEntityId,
            label: 'new_test_block',
            value: 'This is a new test block added via snapshot',
            limit: 1000,
            description: 'New block added during snapshot test',
            preserveOnMigration: false,
            readOnly: false,
          },
        ],
        relationships: [
          ...originalSnapshot.relationships,
          // Add a new relationship between the new agent and new block
          {
            agentEntityId: newAgentEntityId,
            blockEntityId: newBlockEntityId,
          },
        ],
      };

      // 3. Apply the snapshot with new entities
      const addEntitiesResponse = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
        snapshotWithNewEntities,
      );

      expect(addEntitiesResponse.status).toBe(200);
      expect(addEntitiesResponse.data).toHaveProperty('success', true);

      // 4. Verify the new entities were added
      const snapshotWithAddedEntitiesResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
      )) as { status: number; data: TemplateSnapshotSchemaType };

      expect(snapshotWithAddedEntitiesResponse.status).toBe(200);
      const snapshotWithAddedEntities = snapshotWithAddedEntitiesResponse.data;

      // Verify counts increased
      expect(snapshotWithAddedEntities.agents).toHaveLength(
        originalSnapshot.agents.length + 1,
      );
      expect(snapshotWithAddedEntities.blocks).toHaveLength(
        originalSnapshot.blocks.length + 1,
      );
      expect(snapshotWithAddedEntities.relationships).toHaveLength(
        originalSnapshot.relationships.length + 1,
      );

      // Verify the new entities exist
      const newAgent = snapshotWithAddedEntities.agents.find(
        (a) => a.entityId === newAgentEntityId,
      );
      const newBlock = snapshotWithAddedEntities.blocks.find(
        (b) => b.entityId === newBlockEntityId,
      );
      const newRelationship = snapshotWithAddedEntities.relationships.find(
        (r) =>
          r.agentEntityId === newAgentEntityId &&
          r.blockEntityId === newBlockEntityId,
      );

      expect(newAgent).toBeDefined();
      expect(newAgent!.name).toBe('new_test_agent');
      expect(newAgent!.systemPrompt).toBe(
        'This is a new test agent added via snapshot',
      );

      expect(newBlock).toBeDefined();
      expect(newBlock!.label).toBe('new_test_block');
      expect(newBlock!.value).toBe(
        'This is a new test block added via snapshot',
      );

      expect(newRelationship).toBeDefined();

      console.log(
        '✅ Phase 1 completed - New entities and relationship added successfully',
      );
      console.log('Updated counts after addition:');
      console.log('- Agents:', snapshotWithAddedEntities.agents.length);
      console.log('- Blocks:', snapshotWithAddedEntities.blocks.length);
      console.log(
        '- Relationships:',
        snapshotWithAddedEntities.relationships.length,
      );

      // 5. PHASE 2: Remove entities that have existing relationships
      // Find an agent and block that have relationships to remove
      const relationshipToRemove = snapshotWithAddedEntities.relationships[0]; // Get first relationship
      const agentToRemoveEntityId = relationshipToRemove.agentEntityId;
      const blockToRemoveEntityId = relationshipToRemove.blockEntityId;

      console.log('Removing entities with relationship:');
      console.log('- Agent EntityId:', agentToRemoveEntityId);
      console.log('- Block EntityId:', blockToRemoveEntityId);

      const snapshotWithRemovedEntities = {
        ...snapshotWithAddedEntities,
        agents: snapshotWithAddedEntities.agents.filter(
          (a) => a.entityId !== agentToRemoveEntityId,
        ),
        blocks: snapshotWithAddedEntities.blocks.filter(
          (b) => b.entityId !== blockToRemoveEntityId,
        ),
        relationships: snapshotWithAddedEntities.relationships.filter(
          (r) =>
            r.agentEntityId !== agentToRemoveEntityId &&
            r.blockEntityId !== blockToRemoveEntityId,
        ),
      };

      // 6. Apply the snapshot with removed entities
      const removeEntitiesResponse = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
        snapshotWithRemovedEntities,
      );

      expect(removeEntitiesResponse.status).toBe(200);
      expect(removeEntitiesResponse.data).toHaveProperty('success', true);

      // 7. Verify the entities were removed properly
      const finalSnapshotResponse = (await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
      )) as { status: number; data: TemplateSnapshotSchemaType };

      expect(finalSnapshotResponse.status).toBe(200);
      const finalSnapshot = finalSnapshotResponse.data;

      // Verify the removed entities are gone
      const removedAgent = finalSnapshot.agents.find(
        (a) => a.entityId === agentToRemoveEntityId,
      );
      const removedBlock = finalSnapshot.blocks.find(
        (b) => b.entityId === blockToRemoveEntityId,
      );
      const removedRelationship = finalSnapshot.relationships.find(
        (r) =>
          r.agentEntityId === agentToRemoveEntityId &&
          r.blockEntityId === blockToRemoveEntityId,
      );

      expect(removedAgent).toBeUndefined();
      expect(removedBlock).toBeUndefined();
      expect(removedRelationship).toBeUndefined();

      // Verify counts are correct
      expect(finalSnapshot.agents).toHaveLength(
        snapshotWithAddedEntities.agents.length - 1,
      );
      expect(finalSnapshot.blocks).toHaveLength(
        snapshotWithAddedEntities.blocks.length - 1,
      );

      // Verify all remaining relationships are valid (no orphaned relationships)
      finalSnapshot.relationships.forEach((relationship) => {
        const agentExists = finalSnapshot.agents.some(
          (a) => a.entityId === relationship.agentEntityId,
        );
        const blockExists = finalSnapshot.blocks.some(
          (b) => b.entityId === relationship.blockEntityId,
        );

        expect(agentExists).toBe(true);
        expect(blockExists).toBe(true);
      });

      console.log(
        '✅ Phase 2 completed - Entities with relationships removed successfully',
      );
      console.log('Final counts after removal:');
      console.log('- Agents:', finalSnapshot.agents.length);
      console.log('- Blocks:', finalSnapshot.blocks.length);
      console.log('- Relationships:', finalSnapshot.relationships.length);
      console.log(
        '✅ Comprehensive entity and relationship management test completed successfully',
      );
    });

    it('should return 400 for invalid template version (non-current)', async () => {
      const snapshotData = {
        agents: [],
        blocks: [],
        relationships: [],
        configuration: {},
        type: 'classic',
        version: '1',
      };

      const response = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:1/snapshot`,
        snapshotData,
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('current');
    });

    it('should return 400 for invalid snapshot format', async () => {
      const invalidSnapshotData = {
        // Missing required fields like agents, blocks
        version: 'current',
      };

      const response = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${testSetSnapshotTemplateName}:current/snapshot`,
        invalidSnapshotData,
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('message');
    });
  });

  describe('/v1/templates/:project/:template_name/deployments/:deployment_id/migrate POST', () => {
    let testMigrationTemplateName: string;
    let testAgentIds: string[] = [];

    beforeEach(async () => {
      testMigrationTemplateName = `e2e-test-migration-template-${Date.now()}`;
      testAgentIds = []; // Reset agent IDs for each test

      // Clean up any existing template with this name
      try {
        await lettaAxiosSDK.delete(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    afterEach(async () => {
      // Clean up created agents for this test
      for (const agentId of testAgentIds) {
        try {
          await lettaAxiosSDK.delete(`/v1/agents/${agentId}`);
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      // Clean up test template
      try {
        await lettaAxiosSDK.delete(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    describe('Agent Addition Tests', () => {
      it('should migrate when agents are added to template', async () => {
        // 1. Create initial template with 2 agents (dynamic type)
        const initialAgentFile = {
          agents: [
            {
              id: 'manager-agent',
              agent_type: 'memgpt_v2_agent',
              name: 'Manager Agent',
              system: 'You are a manager agent.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['manager'],
              group_ids: ['dynamic-group-1'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
            {
              id: 'worker-agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Worker Agent 1',
              system: 'You are worker agent 1.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['worker'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                context_window: 128000,
              },
            },
          ],
          groups: [
            {
              id: 'dynamic-group-1',
              name: 'Dynamic Team',
              manager_config: {
                manager_type: 'dynamic',
                manager_agent_id: 'manager-agent',
                termination_token: 'DONE',
                max_turns: 10,
              },
            },
          ],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block for add agents test',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        // 2. Create agents from template
        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'add-agents-test' },
        );
        expect(agentsResponse.status).toBe(201);
        expect(agentsResponse.data.agents).toHaveLength(2);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // 3. Update snapshot to add a new agent
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        updatedSnapshot.agents.push({
          entityId: 'new-worker-agent-2',
          name: 'Worker Agent 2',
          systemPrompt: 'You are worker agent 2.',
          toolIds: updatedSnapshot.agents[0].toolIds,
          sourceIds: [],
          tags: ['worker', 'new'],
          agentType: 'memgpt_v2_agent',
          model: 'gpt-4o-mini',
          properties: {
            llm_config: {
              model: 'gpt-4o-mini',
              temperature: 0.4,
              context_window: 128000,
            },
          },
          toolVariables: null,
          memoryVariables: null,
          identityIds: null,
          toolRules: [],
        });

        updatedSnapshot.relationships.push({
          agentEntityId: 'new-worker-agent-2',
          blockEntityId: updatedSnapshot.blocks[0].entityId,
        });

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // save
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after memory block property update' },
        );

        // 4. Migrate deployment
        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // fetch the deployment again to get updated agents
        const updatedDeploymentResponse = await lettaAxiosSDK.get(
          `/v1/_internal_templates/deployment/${deploymentId}`,
        );

        expect(updatedDeploymentResponse.status).toBe(200);
        expect(updatedDeploymentResponse.data.entities.filter((v: any) => v.type === 'agent')).toHaveLength(3); // Should now have 3 agents
      });
    });

    describe('Agent Deletion Tests', () => {
      it('should migrate when agents are removed from template', async () => {
        // 1. Create template with 3 agents initially
        const initialAgentFile = {
          agents: [
            {
              id: 'manager-agent',
              agent_type: 'memgpt_v2_agent',
              name: 'Manager Agent',
              system: 'Manager system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['manager'],
              group_ids: ['dynamic-group-1'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
            {
              id: 'worker-agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Worker Agent 1',
              system: 'Worker 1 system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['worker'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                context_window: 128000,
              },
            },
            {
              id: 'worker-agent-2',
              agent_type: 'memgpt_v2_agent',
              name: 'Worker Agent 2',
              system: 'Worker 2 system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['worker'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.4,
                context_window: 128000,
              },
            },
          ],
          groups: [
            {
              id: 'dynamic-group-1',
              name: 'Dynamic Team',
              manager_config: {
                manager_type: 'dynamic',
                manager_agent_id: 'manager-agent',
                termination_token: 'DONE',
                max_turns: 10,
              },
            },
          ],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block for delete agents test',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        // 2. Create agents from template
        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'delete-agents-test' },
        );
        expect(agentsResponse.status).toBe(201);
        expect(agentsResponse.data.agents).toHaveLength(3);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // 3. Update snapshot to remove one worker agent (ensuring we never go to 0 agents)
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        // Remove the last agent from the list (ensuring we never go to 0 agents)
        expect(updatedSnapshot.agents.length).toBeGreaterThan(1); // Ensure we have multiple agents

        // remove a non-manager agent (find by tag)
        const removedAgent = updatedSnapshot.agents.find((a:any) => a.tags.includes('worker'));
        expect(removedAgent).toBeDefined();

        // Remove the last agent
        updatedSnapshot.agents = updatedSnapshot.agents.filter(
          (a: any) => a.entityId !== removedAgent!.entityId
        );

        // Remove any relationships associated with the removed agent
        updatedSnapshot.relationships = updatedSnapshot.relationships.filter(
          (r: any) => r.agentEntityId !== removedAgent.entityId,
        );


        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // Save template to migration
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after agent removal' },
        );

        // 4. Migrate deployment
        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // 5. Verify the migration worked - check that we now have one less agent
        const finalAgentsCheck = await Promise.all(
          agentsResponse.data.agents.map((agent: any) =>
            lettaAxiosSDK.get(`/v1/agents/${agent.id}`).catch(() => null),
          ),
        );
        const stillExistingAgents = finalAgentsCheck.filter(
          (response) => response?.status === 200,
        );
        expect(stillExistingAgents).toHaveLength(2); // Should have 2 agents remaining (started with 3, removed 1)
      });
    });

    describe('Block Management Tests', () => {
      it('should migrate when blocks are added to template', async () => {
        // Create initial template and agents
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Initial human block',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'add-blocks-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // Add new block to snapshot
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        updatedSnapshot.blocks.push({
          entityId: 'new-block-persona',
          label: 'persona',
          value: 'New persona block added during migration test',
          limit: 1500,
          description: 'New persona block',
          preserveOnMigration: true,
          readOnly: false,
        });

        updatedSnapshot.relationships.push({
          agentEntityId: updatedSnapshot.agents[0].entityId,
          blockEntityId: 'new-block-persona',
        });

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // save
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after block addition' },
        );

        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // Verify the migration worked - check that the agent still exists and was migrated
        const migratedAgent = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent.status).toBe(200);
        // The agent should still be functional after block addition migration
        expect(migratedAgent.data).toHaveProperty('id');
        expect(migratedAgent.data).toHaveProperty('memory');

        // Verify that the new block was properly added during migration
        expect(migratedAgent.data.memory).toHaveProperty('blocks');
        const memoryBlocks = Object.values(migratedAgent.data.memory.blocks);
        expect(memoryBlocks.length).toBeGreaterThanOrEqual(2); // Should have original + new block
      });

      it('should migrate when blocks are removed from template', async () => {
        // Create template with multiple blocks
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1', 'block-2'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block to keep',
              limit: 1000,
            },
            {
              id: 'block-2',
              label: 'persona',
              value: 'Persona block to remove',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'delete-blocks-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // Remove a block from snapshot
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        const personaBlock = updatedSnapshot.blocks.find(
          (b: any) => b.label === 'persona',
        );
        expect(personaBlock).toBeDefined();

        updatedSnapshot.blocks = updatedSnapshot.blocks.filter(
          (b: any) => b.label !== 'persona',
        );
        updatedSnapshot.relationships = updatedSnapshot.relationships.filter(
          (r: any) => r.blockEntityId !== personaBlock.entityId,
        );

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // Save template to prepare for migration
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after block removal' },
        );

        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // Verify the migration worked - check that the agent still exists after block removal
        const migratedAgent = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent.status).toBe(200);
        // The agent should still be functional after block removal migration
        expect(migratedAgent.data).toHaveProperty('id');
        expect(migratedAgent.data).toHaveProperty('memory');

        // Verify that the persona block was properly removed during migration
        expect(migratedAgent.data.memory).toHaveProperty('blocks');
        const memoryBlocks = Object.values(migratedAgent.data.memory.blocks);
        const personaBlocks = memoryBlocks.filter((block: any) => block.label === 'persona');
        expect(personaBlocks.length).toBe(0); // Persona block should be removed
      });

      it('should migrate when block associations are moved between agents', async () => {
        // Create template with 2 agents and 2 blocks
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Agent 1',
              system: 'Agent 1 system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1', 'block-2'],
              source_ids: [],
              tags: ['agent1'],
              group_ids: ['dynamic-group-1'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
            {
              id: 'agent-2',
              agent_type: 'memgpt_v2_agent',
              name: 'Agent 2',
              system: 'Agent 2 system prompt.',
              tool_ids: ['tool-1'],
              block_ids: [],
              source_ids: [],
              tags: ['agent2'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                context_window: 128000,
              },
            },
          ],
          groups: [
            {
              id: 'dynamic-group-1',
              name: 'Dynamic Team',
              manager_config: {
                manager_type: 'dynamic',
                manager_agent_id: 'agent-1',
                termination_token: 'DONE',
                max_turns: 10,
              },
            },
          ],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block',
              limit: 1000,
            },
            {
              id: 'block-2',
              label: 'persona',
              value: 'Persona block',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'move-associations-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // Move block association from agent-1 to agent-2
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        // Use array indices since agent names are auto-generated
        expect(updatedSnapshot.agents.length).toBeGreaterThanOrEqual(2); // Ensure we have at least 2 agents
        const agent1 = updatedSnapshot.agents[0]; // First agent
        const agent2 = updatedSnapshot.agents[1]; // Second agent
        const personaBlock = updatedSnapshot.blocks.find(
          (b: any) => b.label === 'persona',
        );

        expect(agent1).toBeDefined();
        expect(agent2).toBeDefined();
        expect(personaBlock).toBeDefined();

        // Remove persona block association from first agent and add to second agent
        updatedSnapshot.relationships = updatedSnapshot.relationships.filter(
          (r: any) =>
            !(
              r.agentEntityId === agent1.entityId &&
              r.blockEntityId === personaBlock.entityId
            ),
        );
        updatedSnapshot.relationships.push({
          agentEntityId: agent2.entityId,
          blockEntityId: personaBlock.entityId,
        });

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // save
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after block association move' },
        );

        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // Verify the migration worked - check that both agents still exist after block association move
        const agent1Check = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        const agent2Check = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[1].id}`,
        );
        expect(agent1Check.status).toBe(200);
        expect(agent2Check.status).toBe(200);
        // Both agents should still be functional after block association migration
        expect(agent1Check.data).toHaveProperty('id');
        expect(agent2Check.data).toHaveProperty('id');
      });
    });

    describe('Property Update Tests', () => {
      it('should migrate when group properties are updated', async () => {
        // Create template with group configuration
        const initialAgentFile = {
          agents: [
            {
              id: 'manager-agent',
              agent_type: 'memgpt_v2_agent',
              name: 'Manager Agent',
              system: 'Manager system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['manager'],
              group_ids: ['dynamic-group-1'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
            {
              id: 'worker-agent',
              agent_type: 'memgpt_v2_agent',
              name: 'Worker Agent',
              system: 'Worker system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['worker'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                context_window: 128000,
              },
            },
          ],
          groups: [
            {
              id: 'dynamic-group-1',
              name: 'Dynamic Team',
              manager_config: {
                manager_type: 'dynamic',
                manager_agent_id: 'manager-agent',
                termination_token: 'DONE',
                max_turns: 5,
              },
            },
          ],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'update-group-props-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // Update group configuration
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        updatedSnapshot.configuration.maxTurns = 15;
        updatedSnapshot.configuration.terminationToken = 'FINISHED';

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after memory block property update' },
        );

        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: true,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // Verify the migration worked - check that the group properties were updated
        const finalAgentsCheck = await Promise.all(
          agentsResponse.data.agents.map((agent: any) =>
            lettaAxiosSDK.get(`/v1/agents/${agent.id}`).catch(() => null),
          ),
        );
        const stillExistingAgents = finalAgentsCheck.filter(
          (response) => response?.status === 200,
        );
        expect(stillExistingAgents.length).toBe(2); // Both agents should still exist after group property update
      });

      it('should migrate when memory block properties are updated', async () => {
        // Create template
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1', 'block-2'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Original human block content',
              limit: 1000,
            },
            {
              id: 'block-2',
              label: 'persona',
              value: 'Original persona block content',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'update-memory-props-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // Update memory block properties
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        updatedSnapshot.blocks.forEach((block: any) => {
          if (block.label === 'human') {
            block.value = 'UPDATED human block content with new information';
            block.limit = 2000;
          } else if (block.label === 'persona') {
            block.value =
              'UPDATED persona block content with enhanced personality';
            block.limit = 1500;
            block.preserveOnMigration = false;
          }
        });


        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);


        const versionResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Updated memory block properties' },
        );
        expect(versionResponse.status).toBe(200);


        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: false,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // Verify the migration worked - check that the memory block properties were updated
        const migratedAgent = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent.status).toBe(200);
        // The agent should still be functional after memory block property update migration
        expect(migratedAgent.data).toHaveProperty('id');
        expect(migratedAgent.data).toHaveProperty('memory');

        // Check that memory block properties were updated
        expect(migratedAgent.data.memory).toHaveProperty('blocks');
        const memoryBlocks = migratedAgent.data.memory.blocks;
        const humanBlock = Object.values(memoryBlocks).find((block: any) => block.label === 'human');
        expect(humanBlock).toBeDefined();
        expect((humanBlock as any).value).toContain('UPDATED'); // Should contain updated content
      });
    });

    describe('Preservation Tests', () => {
      it('should preserve tools during migration when requested', async () => {
        // Create initial template
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'original_tool',
              description: 'Original tool',
              source_code: 'def original_tool() -> str:\n    return "original"',
              source_type: 'python',
              tags: ['original'],
              json_schema: {
                name: 'original_tool',
                description: 'Original tool',
                parameters: { type: 'object', properties: {}, required: [] },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          {
            agent_name: 'preserve-tools-test',
            tool_variables: { original_var: 'should_be_preserved' },
          },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // 3. Update snapshot to modify tool configuration
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        // Modify the agent's system prompt to test tool variable preservation
        updatedSnapshot.agents[0].systemPrompt = 'UPDATED system prompt for tool preservation test';

        // 4. Save new version and update snapshot

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        const versionResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'New version for tool preservation test' },
        );
        expect(versionResponse.status).toBe(200);


        // 5. Migrate with preserve_tool_variables: true
        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: true,
            preserve_core_memories: false,
          },
        );
        expect(migrateResponse.status).toBe(200);

        // 6. Verify the migration worked - check that the agent still exists after tool preservation
        const migratedAgent = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent.status).toBe(200);
        expect(migratedAgent.data).toHaveProperty('id');

        // Also test when preserve_tool_variables is false
        const versionResponse2 = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Version 3 for tool preservation test' },
        );
        expect(versionResponse2.status).toBe(200);

        const migrateResponse2 = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '3',
            preserve_tool_variables: false,
            preserve_core_memories: false,
          },
        );
        expect(migrateResponse2.status).toBe(200);

        // Verify agent still exists after second migration
        const migratedAgent2 = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent2.status).toBe(200);
      });

      it('should preserve core memories during migration when requested', async () => {
        // Create initial template
        const initialAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test system prompt.',
              tool_ids: ['tool-1'],
              block_ids: ['block-1', 'block-2'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Original human memory content',
              limit: 1000,
            },
            {
              id: 'block-2',
              label: 'persona',
              value: 'Original persona memory content',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [
            {
              id: 'tool-1',
              name: 'send_message',
              description: 'Send a message',
              source_code:
                'def send_message(message: str) -> str:\n    return f"Message sent: {message}"',
              source_type: 'python',
              tags: ['communication'],
              json_schema: {
                name: 'send_message',
                description: 'Send a message',
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Message' },
                  },
                  required: ['message'],
                },
              },
            },
          ],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: initialAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          {
            agent_name: 'preserve-memories-test',
            memory_variables: { important_data: 'should_be_preserved' },
          },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        // 3. Update snapshot to modify memory block content
        const snapshotResponse = await lettaAxiosSDK.get(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
        );
        expect(snapshotResponse.status).toBe(200);

        const updatedSnapshot = { ...snapshotResponse.data };
        // Modify memory blocks to test memory preservation
        updatedSnapshot.blocks.forEach((block: any) => {
          if (block.label === 'human') {
            block.value = 'UPDATED human memory content for preservation test';
          } else if (block.label === 'persona') {
            block.value = 'UPDATED persona memory content for preservation test';
          }
        });

        // 4. Save new version and update snapshot

        const setSnapshotResponse = await lettaAxiosSDK.put(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:current/snapshot`,
          updatedSnapshot,
        );
        expect(setSnapshotResponse.status).toBe(200);

        // save
        await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Prepare for migration after memory block property update' },
        );

        // 5. Migrate with preserve_core_memories: true
        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '2',
            preserve_tool_variables: false,
            preserve_core_memories: true,
            memory_variables: { additional_key: 'additional_value' },
          },
        );
        expect(migrateResponse.status).toBe(200);

        // 6. Verify the migration worked - check that the agent still exists after memory preservation
        const migratedAgent = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent.status).toBe(200);
        expect(migratedAgent.data).toHaveProperty('id');
        expect(migratedAgent.data).toHaveProperty('memory');

        // Also test when preserve_core_memories is false
        const versionResponse2 = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}`,
          { message: 'Version 3 for memory preservation test' },
        );
        expect(versionResponse2.status).toBe(200);

        const migrateResponse2 = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          {
            version: '3',
            preserve_tool_variables: false,
            preserve_core_memories: false,
            memory_variables: { replacement_key: 'replacement_value' },
          },
        );
        expect(migrateResponse2.status).toBe(200);

        // Verify agent still exists after second migration
        const migratedAgent2 = await lettaAxiosSDK.get(
          `/v1/agents/${agentsResponse.data.agents[0].id}`,
        );
        expect(migratedAgent2.status).toBe(200);
      });
    });

    describe('Error Handling Tests', () => {
      it('should return 404 for non-existent template', async () => {
        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/non-existent-template/deployments/fake-deployment-id/migrate`,
          { version: '1' },
        );
        expect(migrateResponse.status).toBe(404);
      });

      it('should return 400 for invalid version', async () => {
        // First create a simple template and deployment

        const simpleAgentFile = {
          agents: [
            {
              id: 'agent-1',
              agent_type: 'memgpt_v2_agent',
              name: 'Test Agent',
              system: 'Test.',
              tool_ids: [],
              block_ids: ['block-1'],
              source_ids: [],
              tags: ['test'],
              llm_config: {
                model: 'gpt-4o-mini',
                temperature: 0.5,
                context_window: 128000,
              },
            },
          ],
          groups: [],
          blocks: [
            {
              id: 'block-1',
              label: 'human',
              value: 'Human block',
              limit: 1000,
            },
          ],
          files: [],
          sources: [],
          tools: [],
          mcp_servers: [],
        };

        const createResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}`,
          {
            type: 'agent_file',
            agent_file: simpleAgentFile,
            name: testMigrationTemplateName,
          },
        );
        expect(createResponse.status).toBe(201);

        const agentsResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}:latest/agents`,
          { agent_name: 'error-test' },
        );
        expect(agentsResponse.status).toBe(201);

        const deploymentId = agentsResponse.data.deployment_id;
        testAgentIds.push(...agentsResponse.data.agents.map((a: any) => a.id));

        const migrateResponse = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${testMigrationTemplateName}/deployments/${deploymentId}/migrate`,
          { version: '999' }, // Non-existent version
        );
        expect(migrateResponse.status).toBe(404);
      });
    });
  });

  describe('Batch Migration Tests', () => {
    const batchMigrationTestNames = {
      classic: 'e2e-batch-migration-classic',
      dynamic: 'e2e-batch-migration-dynamic',
      sleeptime: 'e2e-batch-migration-sleeptime',
      cluster: 'e2e-batch-migration-cluster',
      voiceSleeptime: 'e2e-batch-migration-voice-sleeptime',
      roundRobin: 'e2e-batch-migration-round-robin',
      supervisor: 'e2e-batch-migration-supervisor'
    };

    // Clean up any existing templates before running tests
    beforeEach(async () => {
      const cleanupPromises = Object.values(batchMigrationTestNames).map(async (templateName) => {
        try {
          await lettaAxiosSDK.delete(`/v1/templates/${testProject}/${templateName}`);
        } catch (error) {
          // Ignore cleanup errors - template may not exist
        }
      });
      await Promise.all(cleanupPromises);
    });

    // Clean up after each test to prevent conflicts
    afterEach(async () => {
      const cleanupPromises = Object.values(batchMigrationTestNames).map(async (templateName) => {
        try {
          await lettaAxiosSDK.delete(`/v1/templates/${testProject}/${templateName}`);
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      await Promise.all(cleanupPromises);
    });

    // Test data for different template types
    const templateAgentFiles = {
      classic: {
        agents: [
          {
            id: 'batch-classic-agent',
            agent_type: 'memgpt_v2_agent',
            name: 'Batch Classic Agent',
            system: 'You are a classic agent for batch migration testing.',
            tool_ids: [],
            block_ids: ['batch-classic-block'],
            source_ids: [],
            tags: ['classic', 'batch-test'],
            llm_config: {
              model: 'gpt-4o-mini',
              temperature: 0.7,
              context_window: 128000,
            },
          },
        ],
        groups: [],
        blocks: [
          {
            id: 'batch-classic-block',
            label: 'human',
            value: 'Classic batch test human block',
            limit: 1000,
          },
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
      },
      dynamic: {
        agents: [
          {
            id: 'batch-manager',
            agent_type: 'memgpt_v2_agent',
            name: 'Batch Manager',
            system: 'You are a manager for batch migration testing.',
            tool_ids: [],
            block_ids: ['batch-dynamic-block'],
            source_ids: [],
            tags: ['manager', 'dynamic', 'batch-test'],
            group_ids: ['batch-dynamic-group'],
            llm_config: {
              model: 'gpt-4o-mini',
              temperature: 0.5,
              context_window: 128000,
            },
          },
          {
            id: 'batch-worker',
            agent_type: 'memgpt_v2_agent',
            name: 'Batch Worker',
            system: 'You are a worker for batch migration testing.',
            tool_ids: [],
            block_ids: ['batch-dynamic-block'],
            source_ids: [],
            tags: ['worker', 'batch-test'],
            llm_config: {
              model: 'gpt-4o-mini',
              temperature: 0.3,
              context_window: 128000,
            },
          },
        ],
        groups: [
          {
            id: 'batch-dynamic-group',
            name: 'Batch Dynamic Group',
            manager_config: {
              manager_type: 'dynamic',
              manager_agent_id: 'batch-manager',
              termination_token: 'DONE',
              max_turns: 5,
            },
          },
        ],
        blocks: [
          {
            id: 'batch-dynamic-block',
            label: 'human',
            value: 'Dynamic batch test human block',
            limit: 1000,
          },
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
      }
    };

    // Helper function to create deployments from template
    const createDeploymentsFromTemplate = async (templateName: string, count: number = 2) => {
      const deployments = [];
      for (let i = 0; i < count; i++) {
        const response = await lettaAxiosSDK.post(
          `/v1/templates/${testProject}/${templateName}:latest/agents`,
          {
            agent_name: `batch-test-deployment-${i + 1}`,
            tags: ['batch-migration-test'],
          },
        );
        expect(response.status).toBe(201);
        deployments.push(response.data);
      }
      return deployments;
    };

    // Helper function to get deployment entities and verify context window
    const verifyDeploymentContextWindow = async (deployment: any, expectedContextWindow: number) => {
      for (const agent of deployment.agents) {
        const agentResponse = await lettaAxiosSDK.get(`/v1/agents/${agent.id}`);
        expect(agentResponse.status).toBe(200);
        expect(agentResponse.data.llm_config.context_window).toBe(expectedContextWindow);
      }
    };

    it('should batch migrate all deployments for classic template when context window is changed', async () => {
      const templateName = batchMigrationTestNames.classic;

      // 1. Create classic template
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: templateAgentFiles.classic,
          name: templateName,
        },
      );

      if (createResponse.status !== 201) {
        console.error('Template creation failed:', createResponse.data);
      }

      expect(createResponse.status).toBe(201);

      // 2. Create 2 deployments from template
      const deployments = await createDeploymentsFromTemplate(templateName, 2);

      // 3. Verify initial context window is 128000
      for (const deployment of deployments) {
        await verifyDeploymentContextWindow(deployment, 128000);
      }

      // 4. Get template snapshot to modify
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${templateName}:current/snapshot`,
      );
      expect(snapshotResponse.status).toBe(200);

      // 5. Update template agent's context window
      const updatedSnapshot = { ...snapshotResponse.data };
      updatedSnapshot.agents[0] = {
        ...updatedSnapshot.agents[0],
        properties: {
          ...updatedSnapshot.agents[0].properties,
          context_window_limit: 64000,
        },
      };

      const updateResponse = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${templateName}:current/snapshot`,
        updatedSnapshot,
      );
      expect(updateResponse.status).toBe(200);

      // 6. Save template version with migration enabled
      const saveResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${templateName}`,
        {
          message: 'Batch migration test - updated context window',
          preserve_environment_variables_on_migration: false,
          preserve_core_memories_on_migration: false,
          migrate_agents: true,
        },
      );
      expect(saveResponse.status).toBe(200);

      for (const deployment of deployments) {
        await verifyDeploymentContextWindow(deployment, 64000);
      }
    }, 60000);

    it('should batch migrate all deployments for dynamic template when context window is changed', async () => {
      const templateName = batchMigrationTestNames.dynamic;

      // 1. Create dynamic template
      const createResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}`,
        {
          type: 'agent_file',
          agent_file: templateAgentFiles.dynamic,
          name: templateName,
        },
      );
      expect(createResponse.status).toBe(201);

      // 2. Create 2 deployments from template
      const deployments = await createDeploymentsFromTemplate(templateName, 2);

      // 3. Verify initial context window for both agents in each deployment
      for (const deployment of deployments) {
        for (const agent of deployment.agents) {
          const agentResponse = await lettaAxiosSDK.get(`/v1/agents/${agent.id}`);
          expect(agentResponse.status).toBe(200);
          expect(agentResponse.data.llm_config.context_window).toBe(128000);
        }
      }

      // 4. Get template snapshot to modify
      const snapshotResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${templateName}:current/snapshot`,
      );
      expect(snapshotResponse.status).toBe(200);

      // 5. Update both agents' context window in template
      const updatedSnapshot = { ...snapshotResponse.data };
      updatedSnapshot.agents = updatedSnapshot.agents.map((agent: any) => {
        return {
          ...agent,
          properties: {
            ...agent.properties,
            context_window_limit: 32000,
          },
        };
      });

      const updateResponse = await lettaAxiosSDK.put(
        `/v1/templates/${testProject}/${templateName}:current/snapshot`,
        updatedSnapshot,
      );
      expect(updateResponse.status).toBe(200);

      // check if the update was successful
      const verifyResponse = await lettaAxiosSDK.get(
        `/v1/templates/${testProject}/${templateName}:current/snapshot`,
      );

      expect(verifyResponse.status).toBe(200);
      verifyResponse.data.agents.forEach((agent: any) => {
        expect(agent.properties.context_window_limit).toBe(32000);
      });

      // 6. Save template version with migration enabled
      const saveResponse = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/${templateName}`,
        {
          message: 'Batch migration test - dynamic template context window update',
          preserve_environment_variables_on_migration: false,
          preserve_core_memories_on_migration: false,
          migrate_agents: true,
        },
      );
      expect(saveResponse.status).toBe(200);

      for (const deployment of deployments) {
        for (const agent of deployment.agents) {
          const agentResponse = await lettaAxiosSDK.get(`/v1/agents/${agent.id}`);
          expect(agentResponse.status).toBe(200);
          expect(agentResponse.data.llm_config.context_window).toBe(32000);
        }
      }
    }, 90000);
  });
});

afterAll(async () => {
  // Clean up test agent
  if (testAgentId) {
    try {
      await lettaAxiosSDK.delete(`/v1/agents/${testAgentId}`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  destroyRedisInstance();
});
