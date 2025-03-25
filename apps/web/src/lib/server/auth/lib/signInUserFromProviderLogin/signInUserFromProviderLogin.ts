'use server';
import type { UserSession } from '@letta-cloud/sdk-web';
import type { ProviderUserPayload } from '@letta-cloud/sdk-web';
import { setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { cookies } from 'next/headers';
import { setRedisData } from '@letta-cloud/service-redis';
import {
  findOrCreateUserAndOrganizationFromProviderLogin,
  type NewUserDetails,
} from '@letta-cloud/service-auth';

const SESSION_EXPIRY_MS = 31536000000; // one year

interface SignInUserFromProviderLoginResponse {
  newUserDetails: NewUserDetails | undefined;
  isNewUser: boolean;
  user: UserSession;
}

export async function signInUserFromProviderLogin(
  userData: ProviderUserPayload,
): Promise<SignInUserFromProviderLoginResponse> {
  const { user, isNewUser, newUserDetails } =
    await findOrCreateUserAndOrganizationFromProviderLogin(userData);

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + SESSION_EXPIRY_MS;

  await setCookie(CookieNames.LETTA_SESSION, {
    sessionId,
    expires,
  });

  await setCookie(CookieNames.CLOUD_API_SESSION, {
    sessionId,
    expires,
  });

  (await cookies()).set(CookieNames.THEME, user.theme);

  await setRedisData(
    'userSession',
    { sessionId },
    {
      expiresAt: expires,
      data: user,
    },
  );

  return {
    isNewUser,
    newUserDetails,
    user,
  };
}
