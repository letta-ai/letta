import {
  findOrCreateUserAndOrganizationFromProviderLogin,
  internal__getAnOrganizationAPIKey,
} from '@letta-cloud/service-auth';
import { lettaAxiosSDK } from './constants';

export async function getAgentByName(name: string) {
  const agentsList = await lettaAxiosSDK.get(`/v1/agents?name=${name}`);
  return agentsList.data[0];
}

export async function getAPIKey() {
  const user = await findOrCreateUserAndOrganizationFromProviderLogin({
    provider: 'google',
    email: 'api-tester@letta.com',
    skipOnboarding: true,
    name: 'API tester',
    uniqueId: 'apitester',
    imageUrl: '',
  });

  if (!user) {
    throw new Error('Failed to create fake user');
  }

  const key = await internal__getAnOrganizationAPIKey(
    user.user.activeOrganizationId,
  );

  if (!key) {
    throw new Error('Failed to get API key');
  }

  return key.apiKey;
}
