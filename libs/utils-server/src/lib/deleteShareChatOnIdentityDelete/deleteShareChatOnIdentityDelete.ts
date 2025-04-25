import { db, shareChatIdentity } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export async function deleteShareChatOnIdentityDelete(
  url: string,
  method: string,
) {
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
