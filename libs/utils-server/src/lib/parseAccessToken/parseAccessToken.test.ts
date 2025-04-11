import { parseAccessToken } from './parseAccessToken';
import { accessTokenPrefixToType } from '@letta-cloud/types';

jest.mock('@letta-cloud/types', () => ({
  accessTokenPrefixToType: {
    'sk-let': 'client-side',
  },
}));

describe('parseAccessToken', () => {
  it('should parse an access token with a prefix', async () => {
    const accessToken = 'sk-let-' + btoa('org123:password123');

    const result = await parseAccessToken(accessToken);

    expect(result).toEqual({
      type: 'client-side',
      organizationId: 'org123',
      accessPassword: 'password123',
    });
  });

  it('should parse an access token without a prefix', async () => {
    const accessToken = btoa('org456:password456');

    const result = await parseAccessToken(accessToken);

    expect(result).toEqual({
      type: 'server-side',
      organizationId: 'org456',
      accessPassword: 'password456',
    });
  });

  it('should throw an error for an invalid token format', async () => {
    const accessToken = 'invalid-token';

    await expect(parseAccessToken(accessToken)).rejects.toThrowError();
  });
});
