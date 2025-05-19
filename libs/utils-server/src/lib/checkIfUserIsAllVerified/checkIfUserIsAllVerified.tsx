import {
  db,
  users,
  verifiedEmail,
  verifiedPhoneNumber,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export async function getTheUserVerifiedContacts(userId: string) {
  const [verifiedPhone, verifiedEmailAddress] = await Promise.all([
    db.query.verifiedPhoneNumber.findFirst({
      where: eq(verifiedPhoneNumber.userId, userId),
    }),
    db.query.verifiedEmail.findFirst({
      where: eq(verifiedEmail.userId, userId),
    }),
  ]);

  return {
    verifiedPhone: verifiedPhone?.phoneNumber,
    verifiedEmail: verifiedEmailAddress?.email,
  };
}

export async function checkIfUserIsAllVerified(userId: string) {
  const { verifiedPhone, verifiedEmail } =
    await getTheUserVerifiedContacts(userId);

  if (!verifiedPhone || !verifiedEmail) {
    return false;
  }

  await db
    .update(users)
    .set({
      verifiedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return true;
}
