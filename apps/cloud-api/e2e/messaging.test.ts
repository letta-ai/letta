import { BASE_URL, lettaAxiosSDK } from './constants';
import {
  destroyRedisInstance,
  setRedisData,
  getRedisData,
  getRecurringCreditUsageKey, createRedisInstance
} from '@letta-cloud/service-redis';
import waitOn from 'wait-on';
import { getAgentByName, getAPIKey } from './helpers';
import {
  findOrCreateUserAndOrganizationFromProviderLogin, internal__getAnOrganizationAPIKey
} from '@letta-cloud/service-auth';
import {
  getOrganizationCredits,
  getRemainingRecurrentCredits,
  addCreditsToOrganization,
  removeCreditsFromOrganization,
  incrementRecurrentCreditUsage, decrementRecurrentCreditUsage
} from '@letta-cloud/utils-server';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getRecurrentSubscriptionLimits } from '@letta-cloud/utils-shared';

const testAgentName = 'message-test-agent';
let testOrganizationId: string;
let testAgentId: string;

// Helper to get core organization ID from Redis
async function getCoreOrganizationId(organizationId: string): Promise<string> {
  const coreOrgData = await getRedisData('organizationToCoreOrganization', { organizationId });
  if (!coreOrgData) {
    throw new Error(`Could not find core organization ID for ${organizationId}`);
  }
  return coreOrgData.coreOrganizationId;
}

// Helper to poll for value changes with configurable comparison
async function waitForValueChange<T>(
  getValue: () => Promise<T>,
  compareFn: (newValue: T, previousValue: T) => boolean,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    description?: string;
  } = {}
): Promise<T> {
  const { intervalMs = 2000, maxAttempts = 3, description = 'value' } = options;

  let currentValue = await getValue();
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const newValue = await getValue();

    if (compareFn(newValue, currentValue)) {
      console.log(`[waitForValueChange] ${description} condition met after ${attempts + 1} attempts`);
      return newValue;
    }

    currentValue = newValue;
    attempts++;
  }

  console.log(`[waitForValueChange] ${description} did not meet condition after ${maxAttempts} attempts`);
  return currentValue;
}

beforeAll(async () => {
  await waitOn({
    resources: [BASE_URL],
    timeout: 30 * 1000,
  });

  // Get or create test user and organization
  const user = await findOrCreateUserAndOrganizationFromProviderLogin({
    provider: 'google',
    email: 'messaging-tester@letta.com',
    skipOnboarding: true,
    name: 'Messaging Tester',
    uniqueId: 'messagingtester',
    isVerified: true,
    imageUrl: '',
  });

  if (!user) {
    throw new Error('Failed to create test user');
  }

  testOrganizationId = user.user.activeOrganizationId;


  const key = await internal__getAnOrganizationAPIKey(
    user.user.activeOrganizationId,
  );

  if (!key) {
    throw new Error('Failed to get API key');
  }


  lettaAxiosSDK.defaults.headers.common['Authorization'] = `Bearer ${key.apiKey}`;

  // Delete existing test agent if it exists
  const existingAgent = await getAgentByName(testAgentName);
  if (existingAgent) {
    await lettaAxiosSDK.delete(`/v1/agents/${existingAgent.id}`);
  }

  // Create fresh test agent
  const agentResponse = await lettaAxiosSDK.post('/v1/agents', {
    name: testAgentName,
    description: 'test agent for messaging e2e tests',
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

  expect(agentResponse.status).toBe(201);
  testAgentId = agentResponse.data.id;

  console.log(`Created test agent: ${testAgentId} for organization: ${testOrganizationId}`);
}, 100000);

afterAll(async () => {
  // Clean up: delete test agent
  if (testAgentId) {
    await lettaAxiosSDK.delete(`/v1/agents/${testAgentId}`);
  }

  // Destroy Redis connection
  await destroyRedisInstance();
});

describe('Messaging with Credit Balances', () => {
  beforeEach(async () => {
    // Reset step cost schema to 1 credit per message for all tests
    const modelData = await getRedisData('modelNameAndEndpointToIdMap', {
      modelName: 'gpt-4o-mini',
      modelEndpoint: 'https://api.openai.com/v1',
    });

    if (modelData) {
      await setRedisData('stepCostSchema', { modelId: modelData.modelId }, {
        data: {
          version: '1',
          data: [{ maxContextWindowSize: 1000000, cost: 1 }]
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });

    }
  });

  describe('Recurring Balance Tests', () => {
    beforeEach(async () => {
      // Reset purchased credits to 0 using the proper helpers
      const currentCredits = await getOrganizationCredits(testOrganizationId);
      if (currentCredits > 0) {
        const coreOrganizationId = await getCoreOrganizationId(testOrganizationId);
        await removeCreditsFromOrganization({
          coreOrganizationId,
          amount: currentCredits,
          source: 'e2e_test',
          note: 'Reset credits for test',
        });
      }
    });


    it('should fail messaging when recurring credits exhausted', async () => {
      // Set up pro subscription with recurring credits
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await setRedisData('customerSubscription', { organizationId: testOrganizationId }, {
        data: {
          tier: 'pro',
          cancelled: false,
          billingPeriodStart,
          billingPeriodEnd,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });


      // Ensure no purchased credits
      const currentCredits = await getOrganizationCredits(testOrganizationId);
      if (currentCredits > 0) {
        const coreOrganizationId = await getCoreOrganizationId(testOrganizationId);
        await removeCreditsFromOrganization({
          coreOrganizationId,
          amount: currentCredits,
          source: 'e2e_test',
          note: 'Remove credits for test',
        });
      }

      // Get subscription to check limits
      const subscription = await getCustomerSubscription(testOrganizationId);
      const initialRecurrentCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        subscription,
      );

      console.log(`Initial recurring credits: ${initialRecurrentCredits}`);

      // Exhaust the recurring credits by incrementing usage to the limit
      if (subscription && initialRecurrentCredits > 0) {
        await incrementRecurrentCreditUsage(
          testOrganizationId,
          subscription,
          initialRecurrentCredits,
        );
      }

      const remainingCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        subscription,
      );

      console.log(`Remaining recurring credits after exhaustion: ${remainingCredits}`);
      expect(remainingCredits).toBe(0);

      // Attempt to send message - should fail with insufficient credits
      const messageResponse = await lettaAxiosSDK.post(
        `/v1/agents/${testAgentId}/messages`,
        {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      );

      // Expect a 402 or 429 status indicating insufficient credits
      expect([402, 429]).toContain(messageResponse.status);

      if (messageResponse.data.message) {
        console.log(`Error message: ${messageResponse.data.message}`);
      }
    }, 60000);
  });

  describe('Purchased Credit Balance Tests', () => {
    beforeEach(async () => {
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await setRedisData('customerSubscription', { organizationId: testOrganizationId }, {
        data: {
          tier: 'pro',
          cancelled: false,
          billingPeriodStart,
          billingPeriodEnd,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });
    });

    it('should fail messaging when purchased credits exhausted', async () => {
      // Reset to 0 credits
      const currentCredits = await getOrganizationCredits(testOrganizationId);
      if (currentCredits > 0) {
        const coreOrganizationId = await getCoreOrganizationId(testOrganizationId);
        await removeCreditsFromOrganization({
          coreOrganizationId,
          amount: currentCredits,
          source: 'e2e_test',
          note: 'Remove all credits for test',
        });
      }

      // set recurring credits to 0 as well
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await setRedisData('customerSubscription', { organizationId: testOrganizationId }, {
        data: {
          tier: 'pro',
          cancelled: false,
          billingPeriodStart,
          billingPeriodEnd,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });

      // set recurring credits to 0
      const subscription = await getCustomerSubscription(testOrganizationId);
      const recurrentCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        subscription,
      );
      if (recurrentCredits > 0) {
        await incrementRecurrentCreditUsage(
          testOrganizationId,
          subscription,
          recurrentCredits,
        );
      }


      const finalCredits = await getOrganizationCredits(testOrganizationId);
      console.log(`Insufficient purchased credits: ${finalCredits}`);
      expect(finalCredits).toBeLessThanOrEqual(0);

      // Attempt to send message - should fail
      const messageResponse = await lettaAxiosSDK.post(
        `/v1/agents/${testAgentId}/messages`,
        {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      );

      // Expect a 402 or 429 status indicating insufficient credits
      expect([402, 429]).toContain(messageResponse.status);

      if (messageResponse.data.message) {
        console.log(`Error message: ${messageResponse.data.message}`);
        expect(messageResponse.data.message).toMatch(/credit|insufficient|balance/i);
      }
    }, 60000);

    it.skip('should prioritize recurring credits over purchased credits', async () => {
      // Set up pro subscription with recurring credits
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await setRedisData('customerSubscription', { organizationId: testOrganizationId }, {
        data: {
          tier: 'pro',
          cancelled: false,
          billingPeriodStart,
          billingPeriodEnd,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });

      // Also add some purchased credits
      const purchasedCredits = 5000;
      await addCreditsToOrganization({
        organizationId: testOrganizationId,
        amount: purchasedCredits,
        source: 'e2e_test',
        note: 'Add credits for prioritization test',
      });

      const initialPurchasedCredits = await getOrganizationCredits(testOrganizationId);
      const oldRecurrentCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        await getCustomerSubscription(testOrganizationId),
      );

      const key = getRecurringCreditUsageKey(
        testOrganizationId,
        await getCustomerSubscription(testOrganizationId),
      );

      const redisInstance = createRedisInstance();

      // set recurrent credits to 0
      await redisInstance.setex(key, 24 * 60 * 60, '0');

      const recurrentCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        await getCustomerSubscription(testOrganizationId),
      );


      console.log(`Initial state - Recurring: ${recurrentCredits}, Purchased: ${initialPurchasedCredits}`);

      // Send a message
      const messageResponse = await lettaAxiosSDK.post(
        `/v1/agents/${testAgentId}/messages`,
        {
          messages: [{ role: 'user', content: 'Please only reply to this message with "hello"' }],
        },
      );

      expect(messageResponse.status).toBe(200);

      // Wait for recurring credit deduction to complete (it's async)
      const finalRecurrentCredits = await waitForValueChange(
        async () => getRemainingRecurrentCredits(
          testOrganizationId,
          await getCustomerSubscription(testOrganizationId),
        ),
        (newValue, oldValue) => newValue !== oldValue, // Exit when credits change
        { description: 'Recurring credits deduction' }
      );

      console.log(`After message - Recurring credits: ${finalRecurrentCredits}`);

      expect(finalRecurrentCredits).toBeLessThan(recurrentCredits);


      // Wait for purchased credit deduction to complete (it's async)
      const finalPurchasedCredits = await waitForValueChange(
        () => getOrganizationCredits(testOrganizationId),
        (newValue, previousValue) => newValue !== previousValue,
        { description: 'purchased credits' }
      );

      console.log(`After message - Purchased credits: ${finalPurchasedCredits}`);

      // Purchased credits should remain the same since recurring credits are used first
      expect(finalPurchasedCredits).toBe(initialPurchasedCredits);

      console.log('Verified recurring credits are prioritized over purchased credits');
    }, 60000);

    it.skip('should exhaust recurring credits then use purchased credits', async () => {
      // Set up Pro tier subscription with recurring credits
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await setRedisData('customerSubscription', { organizationId: testOrganizationId }, {
        data: {
          tier: 'pro',
          cancelled: false,
          billingPeriodStart,
          billingPeriodEnd,
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });

      const subscription = await getCustomerSubscription(testOrganizationId);

      // Set recurring credits to a small amount (e.g., 2 credits)
      const redis = createRedisInstance();
      const recurringCreditKey = getRecurringCreditUsageKey(testOrganizationId, subscription);
      const proLimit = getRecurrentSubscriptionLimits(subscription)
      await redis.set(recurringCreditKey, proLimit - 2); // Set usage so remaining is 2


      const initialRecurringCredits = await getRemainingRecurrentCredits(
        testOrganizationId,
        subscription,
      );
      expect(initialRecurringCredits).toBe(2);


      // Add purchased credits
      const currentPurchasedCredits = await getOrganizationCredits(testOrganizationId);
      const targetPurchasedCredits = 10;
      if (currentPurchasedCredits < targetPurchasedCredits) {
        await addCreditsToOrganization({
          organizationId: testOrganizationId,
          amount: targetPurchasedCredits - currentPurchasedCredits,
          source: 'e2e_test',
          note: 'Add purchased credits for test',
        });
      } else if (currentPurchasedCredits > targetPurchasedCredits) {
        const coreOrganizationId = await getCoreOrganizationId(testOrganizationId);
        await removeCreditsFromOrganization({
          coreOrganizationId,
          amount: currentPurchasedCredits - targetPurchasedCredits,
          source: 'e2e_test',
          note: 'Adjust purchased credits for test',
        });
      }

      // Get model data to modify step cost
      const modelData = await getRedisData('modelNameAndEndpointToIdMap', {
        modelName: 'gpt-4o-mini',
        modelEndpoint: 'https://api.openai.com/v1',
      });

      if (!modelData) {
        throw new Error('Could not find model data for gpt-4');
      }


      // Set step cost to 3 credits per message
      await setRedisData('stepCostSchema', { modelId: modelData.modelId }, {
        data: {
          version: '1',
          data: [{ maxContextWindowSize: 1000000, cost: 3 }]
        },
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      });


      const initialPurchasedCredits = await getOrganizationCredits(testOrganizationId);

      console.log(`Before message - Recurring: ${initialRecurringCredits}, Purchased: ${initialPurchasedCredits}`);


      // Send a message that costs 3 credits (should exhaust 2 recurring + 1 purchased)
      const res = await lettaAxiosSDK.post(`/v1/agents/${testAgentId}/messages`, {
        messages: [{ role: 'user', content: 'Please only reply to this message with "hello"' }],
      });

      expect(res.status).toBe(200);

      // Wait for recurring credits to be deducted
      const finalRecurringCredits = await waitForValueChange(
        () => getRemainingRecurrentCredits(testOrganizationId, subscription),
        (newValue, previousValue) => newValue < previousValue,
        { description: 'recurring credits after exhaustion' }
      );

      // Verify recurring credits are fully exhausted (or nearly exhausted)
      expect(finalRecurringCredits).toBeLessThanOrEqual(0);

      // Wait for purchased credits to be deducted
      const finalPurchasedCredits = await waitForValueChange(
        () => getOrganizationCredits(testOrganizationId),
        (newValue, previousValue) => newValue < previousValue,
        { description: 'purchased credits after exhaustion' }
      );

      console.log(`After message - Recurring: ${finalRecurringCredits}, Purchased: ${finalPurchasedCredits}`);


      // Verify purchased credits were used after recurring credits exhausted
      expect(finalPurchasedCredits).toBeLessThan(initialPurchasedCredits);



      console.log('Verified recurring credits exhaustion causes purchased credits to be used');
    }, 60000);
  });
});
