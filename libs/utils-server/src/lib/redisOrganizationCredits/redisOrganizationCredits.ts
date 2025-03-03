import { createRedisInstance } from '@letta-cloud/service-redis';
import {
  db,
  organizationCredits,
  organizations,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

const ORGANIZATION_CREDITS_REDIS_KEY = 'organizationCredits_1';

export async function getOrganizationCredits(organizationId: string) {
  const redis = createRedisInstance();

  const data = await redis.get(
    `${ORGANIZATION_CREDITS_REDIS_KEY}:${organizationId}`,
  );

  if (data) {
    return parseInt(data, 10);
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
    },
  });

  if (!org) {
    throw new Error(`Could not find organization with id ${organizationId}`);
  }

  const result = await db.query.organizationCredits.findFirst({
    where: eq(organizationCredits.organizationId, org.id),
    columns: {
      credits: true,
    },
  });

  if (!result) {
    throw new Error(
      `Could not find organization credits for organization with id ${organizationId}`,
    );
  }

  await redis.set(
    `${ORGANIZATION_CREDITS_REDIS_KEY}:${organizationId}`,
    result.credits,
  );

  return parseInt(result.credits, 10);
}

export async function setRedisOrganizationCredits(
  organizationId: string,
  credits: number,
) {
  const redis = createRedisInstance();

  await redis.set(
    `${ORGANIZATION_CREDITS_REDIS_KEY}:${organizationId}`,
    credits,
  );
}

export async function incrementRedisOrganizationCredits(
  organizationId: string,
  amount: number,
) {
  const redis = createRedisInstance();

  // first get the current credits
  await getOrganizationCredits(organizationId);

  await redis.incrby(
    `${ORGANIZATION_CREDITS_REDIS_KEY}:${organizationId}`,
    amount,
  );
}

export async function decrementRedisOrganizationCredits(
  organizationId: string,
  amount: number,
) {
  const redis = createRedisInstance();

  // first get the current credits
  await getOrganizationCredits(organizationId);

  await redis.decrby(
    `${ORGANIZATION_CREDITS_REDIS_KEY}:${organizationId}`,
    amount,
  );
}
