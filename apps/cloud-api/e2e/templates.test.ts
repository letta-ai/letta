/* jest-environment node */
import { BASE_URL, lettaAxiosSDK } from './constants';
import { destroyRedisInstance } from '@letta-cloud/service-redis';
import waitOn from 'wait-on';
import { getAgentByName, getAPIKey } from './helpers';

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

    it('should return 400 for template name with version', async () => {
      const response = await lettaAxiosSDK.post(
        `/v1/templates/${testProject}/template-name:version`,
        {
          message: 'Test version save',
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
      expect(response.data.message).toBe(
        'Template name should not contain a version. Use the format: project_slug/template_name',
      );
    });

    it('should return 404 for non-existent project', async () => {
      const response = await lettaAxiosSDK.post(
        '/v1/templates/non-existent-project/template-name',
        {
          message: 'Test version save',
        },
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
