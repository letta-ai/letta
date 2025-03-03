import { signInUserFromProviderLogin } from '$web/server/auth';
import { db, users } from '@letta-cloud/service-database';
import { and, eq, isNull } from 'drizzle-orm';

export async function getAPIStabilityTestingUser() {
  const user = await signInUserFromProviderLogin({
    provider: 'google',
    email: 'api-tester@letta.com',
    skipOnboarding: true,
    name: 'API tester',
    uniqueId: 'apitester',
    imageUrl: '',
  });

  const userFromDb = await db.query.users.findFirst({
    where: and(eq(users.id, user.user.id), isNull(users.deletedAt)),
    columns: {
      activeOrganizationId: true,
      id: true,
      lettaAgentsId: true,
      email: true,
      theme: true,
      submittedOnboardingAt: true,
      imageUrl: true,
      locale: true,
      name: true,
      bannedAt: true,
    },
  });

  return userFromDb;
}
