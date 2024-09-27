import type { NextRequest } from 'next/server';
import {
  extractGoogleIdTokenData,
  generateRedirectSignatureForLoggedInUser,
  signInUserFromProviderLogin,
} from '$letta/server/auth';

export async function GET(req: NextRequest) {
  const idToken = req.nextUrl.searchParams.get('id_token');

  if (process.env.NODE_ENV === 'production' || !idToken) {
    return new Response('Bad Request', { status: 404 });
  }

  const userPayload = await extractGoogleIdTokenData(idToken);

  const { newUserDetails } = await signInUserFromProviderLogin(userPayload);

  return generateRedirectSignatureForLoggedInUser({
    newUserDetails,
  });
}
