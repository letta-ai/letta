import type { NextRequest } from 'next/server';
import {
  extractGoogleIdTokenData,
  generateRedirectSignatureForLoggedInUser,
  signInUserFromProviderLogin,
} from '$web/server/auth';

export async function GET(req: NextRequest) {
  const idToken = req.nextUrl.searchParams.get('id_token');

  if (!idToken) {
    return new Response('Bad Request', { status: 404 });
  }

  const userPayload = await extractGoogleIdTokenData(idToken);

  console.log('y', userPayload);
  const { newUserDetails } = await signInUserFromProviderLogin(userPayload);

  return generateRedirectSignatureForLoggedInUser({
    newUserDetails,
  });
}
