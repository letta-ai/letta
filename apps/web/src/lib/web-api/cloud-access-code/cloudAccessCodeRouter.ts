import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { db, organizations } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { addCreditsToOrganization } from '@letta-cloud/utils-server';
import { dollarsToCredits } from '@letta-cloud/utils-shared';

type CloudAccessCodeRequest = ServerInferRequest<
  typeof contracts.cloudAccessCode.submitCloudAccessCode
>;

type CloudAccessCodeResponse = ServerInferResponses<
  typeof contracts.cloudAccessCode.submitCloudAccessCode
>;

export async function submitCloudAccessCode(
  req: CloudAccessCodeRequest,
): Promise<CloudAccessCodeResponse> {
  const { code } = req.body;

  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (code.toLowerCase() !== 'diamonhacks-rocks') {
    return {
      status: 400,
      body: {
        success: false,
      },
    };
  }

  if (new Date() > new Date('2025-04-07')) {
    return {
      status: 400,
      body: {
        success: false,
      },
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        success: false,
      },
    };
  }

  if (organization.enabledCloudAt) {
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  }

  await db
    .update(organizations)
    .set({
      enabledCloudAt: new Date(),
    })
    .where(eq(organizations.id, activeOrganizationId));

  await addCreditsToOrganization({
    organizationId: activeOrganizationId,
    amount: dollarsToCredits(25),
    source: 'cloud-access-code',
    note: 'SDHacks',
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const cloudAccessCodeRouter = {
  submitCloudAccessCode,
};
