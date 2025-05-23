import { db, users } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { AdminService } from '@letta-cloud/sdk-core';

interface SwapUserOrganization {
  userId: string;
  coreUserId: string;
  organizationId: string;
  coreOrganizationId: string;
}

export async function swapUserOrganization(options: SwapUserOrganization) {
  const { userId, coreUserId, organizationId, coreOrganizationId } = options;

  await Promise.all([
    db
      .update(users)
      .set({ activeOrganizationId: organizationId })
      .where(eq(users.id, userId)),
    AdminService.updateUser({
      requestBody: {
        id: coreUserId,
        organization_id: coreOrganizationId,
      },
    }),
  ]);
}
