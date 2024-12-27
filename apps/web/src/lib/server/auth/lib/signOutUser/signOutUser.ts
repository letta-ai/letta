import { deleteCookie, getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { deleteRedisData } from '@letta-web/redis';

export async function signOutUser() {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return;
  }

  await deleteCookie(CookieNames.LETTA_SESSION);

  await deleteRedisData('userSession', session.sessionId);
}
