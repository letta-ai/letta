import type { ProviderUserPayload } from '@letta-cloud/web-api-client';
import { jwtDecode } from 'jwt-decode';

interface GoogleJWTResponse {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  hd: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name?: string;
  picture?: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
}

export async function extractGoogleIdTokenData(
  idToken: string,
): Promise<ProviderUserPayload> {
  const decodedData = jwtDecode<GoogleJWTResponse>(idToken);

  return {
    email: decodedData.email,
    uniqueId: `google-${decodedData.sub}`,
    provider: 'google',
    imageUrl: decodedData.picture || '',
    name: decodedData.name || '',
  };
}
