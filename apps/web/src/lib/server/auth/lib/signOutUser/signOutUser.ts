import { deleteCookie, getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { deleteRedisData, getRedisData } from '@letta-cloud/service-redis';

export async function signOutUser() {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return;
  }

  const existingSession = await getRedisData('userSession', {
    sessionId: session.sessionId,
  });

  await deleteCookie(CookieNames.LETTA_SESSION);

  await deleteRedisData('userSession', { sessionId: session.sessionId });

  if (existingSession) {
    await deleteRedisData('userIdToUserSession', {
      userId: existingSession.id,
    });
  }
}
