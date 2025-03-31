import { BASE_URL, lettaAxiosSDK } from './constants';
import waitOn from 'wait-on';
import { getAgentByName, getAPIKey } from './helpers';

export const TEST_STAGE: 'branch' | 'main' = process.env.TEST_STAGE as
  | 'branch'
  | 'main';

const testAgentName = 'regression-test-agent';

beforeAll(async () => {
  await waitOn({
    resources: [BASE_URL],
    /* 30 seconds */
    timeout: 30 * 1000,
  });

  const apiKey = await getAPIKey();

  lettaAxiosSDK.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;

  if (TEST_STAGE === 'main') {
    // find agents
    const agent = await getAgentByName(testAgentName);

    // delete agents
    if (agent) {
      await lettaAxiosSDK.delete(`/v1/agents/${agent.id}`);
    }
  }
}, 100000);

describe('Agents', () => {
  if (TEST_STAGE === 'main') {
    it('should create agents', async () => {
      // create agents
      const agent = await lettaAxiosSDK.post('/v1/agents', {
        name: testAgentName,
        description: 'test agent',
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
      });

      expect(agent.status).toBe(201);
      expect(agent.data).toHaveProperty('id');
    });
  }

  it('should update agents', async () => {
    // find agents
    const agent = await getAgentByName(testAgentName);

    if (TEST_STAGE === 'main') {
      expect(agent.description).toBe('test agent');
    } else {
      expect(agent.description).toBe('test agent 2');
    }

    const nextDescription =
      TEST_STAGE === 'main' ? 'test agent 2' : 'test agent 3';

    // update agents
    const updatedAgent = await lettaAxiosSDK.patch(`/v1/agents/${agent.id}`, {
      description: nextDescription,
    });

    expect(updatedAgent.status).toBe(200);
    expect(updatedAgent.data).toHaveProperty('id');
    expect(updatedAgent.data.description).toBe(nextDescription);
  });

  if (TEST_STAGE === 'branch') {
    it('should delete agents', async () => {
      // find agents
      const agent = await getAgentByName(testAgentName);

      // delete agents
      const deletedAgent = await lettaAxiosSDK.delete(`/v1/agents/${agent.id}`);

      expect(deletedAgent.status).toBe(200);
    });
  }
});
