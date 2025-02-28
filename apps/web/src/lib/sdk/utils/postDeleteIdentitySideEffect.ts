import { db, shareChatIdentity } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';

export async function postDeleteIdentitySideEffect(
  url: string,
  method: string,
) {
  if (!url.startsWith('/v1/identities')) {
    return;
  }

  if (method === 'DELETE') {
    const regexp = new RegExp('/v1/identities/(.*)');
    const identityId = regexp.exec(url)?.[1];

    if (!identityId) {
      return;
    }

    await db
      .delete(shareChatIdentity)
      .where(eq(shareChatIdentity.identityId, identityId));
  }
}
