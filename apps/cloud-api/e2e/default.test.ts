import { BASE_URL, lettaAxiosSDK } from './constants';
import { destroyRedisInstance } from '@letta-cloud/service-redis';
import waitOn from 'wait-on';
import { getAgentByName, getAPIKey } from './helpers';

const testAgentName = 'cloud-api-test-agent';

beforeAll(async () => {
  await waitOn({
    resources: [BASE_URL],
    /* 30 seconds */
    timeout: 30 * 1000,
  });

  const apiKey = await getAPIKey();

  lettaAxiosSDK.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;

  // find agents
  const agent = await getAgentByName(testAgentName);

  // delete agents
  if (agent) {
    await lettaAxiosSDK.delete(`/v1/agents/${agent.id}`);
  }
}, 100000);

describe('Agents', () => {
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

  // too many 429
  it.skip('should message agents', async () => {
    // find agents
    const agent = await getAgentByName(testAgentName);

    // message agents
    const message = await lettaAxiosSDK.post(
      `/v1/agents/${agent.id}/messages`,
      {
        messages: [{ role: 'user', content: 'hello' }],
      },
    );

    expect(message.status).toBe(200);
    expect(message.data.messages).toBeInstanceOf(Array);
  }, 100000);

  it('should update agents', async () => {
    // find agents
    const agent = await getAgentByName(testAgentName);

    expect(agent.description).toBe('test agent');

    const nextDescription = 'updated test agent';

    // update agents
    const updatedAgent = await lettaAxiosSDK.patch(`/v1/agents/${agent.id}`, {
      description: nextDescription,
    });

    expect(updatedAgent.status).toBe(200);
    expect(updatedAgent.data).toHaveProperty('id');
    expect(updatedAgent.data.description).toBe(nextDescription);
  });

  it('should delete agents', async () => {
    // find agents
    const agent = await getAgentByName(testAgentName);

    // delete agents
    const deletedAgent = await lettaAxiosSDK.delete(`/v1/agents/${agent.id}`);

    expect(deletedAgent.status).toBe(200);
  });
});

afterAll(() => {
  destroyRedisInstance();
});
