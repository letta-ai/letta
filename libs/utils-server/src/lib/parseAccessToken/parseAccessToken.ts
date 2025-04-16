import { accessTokenPrefixToType } from '@letta-cloud/types';

export async function parseAccessToken(accessToken: string) {
  // access tokens are formatted prefix-base64(organizationId:accessPassword) or base64(organizationId:accessPassword)

  let prefix = '';
  let token = accessToken;

  if (accessToken.includes('sk-let')) {
    prefix = 'sk-let';
    token = accessToken.split('sk-let-')[1];
  }

  if (accessToken.includes('ck-let')) {
    prefix = 'ck-let';
    token = accessToken.split('ck-let-')[1];
  }

  const [organizationId, accessPassword] = atob(token).split(':');

  return {
    type: prefix ? accessTokenPrefixToType[prefix] : 'server-side',
    organizationId,
    accessPassword,
  };
}
