import { AdminService, ToolsService } from '@letta-cloud/sdk-core';
import {
  db,
  organizationBillingDetails,
  organizationCredits,
  organizationPreferences,
  organizations,
  projects,
} from '@letta-cloud/service-database';
import { createPaymentCustomer } from '@letta-cloud/service-payments';
import { eq } from 'drizzle-orm';

interface CreateOrganizationArgs {
  name: string;
  email: string;
  isAdmin?: boolean;
  enableCloud?: boolean;
}

export async function createOrganization(args: CreateOrganizationArgs) {
  const { name, enableCloud } = args;

  const lettaAgentsOrganization = await AdminService.createOrganization({
    requestBody: {
      name,
    },
  });

  if (!lettaAgentsOrganization?.id) {
    throw new Error('Failed to create organization from Letta Agents Service');
  }

  let lettaServiceAccountId = '';

  try {
    const account = await AdminService.createUser({
      requestBody: {
        organization_id: lettaAgentsOrganization.id,
        name: 'Service Account',
      },
    });

    if (!account?.id) {
      throw new Error(
        'Failed to create service account from Letta Agents Service',
      );
    }

    lettaServiceAccountId = account.id;

    await ToolsService.addBaseTools(
      {
        userId: account.id,
      },
      {
        user_id: account.id,
      },
    );
  } catch (e) {
    await AdminService.deleteOrganizationById({
      orgId: lettaAgentsOrganization.id,
    });

    throw e;
  }

  const [createdOrg] = await db
    .insert(organizations)
    .values({
      name,
      lettaAgentsId: lettaAgentsOrganization.id,
      lettaServiceAccountId,
      enabledCloudAt: enableCloud ? new Date() : null,
    })
    .returning({ organizationId: organizations.id });

  try {
    const { id: stripeCustomerId } =
      process.env.IS_CYPRESS_RUN || process.env.USE_FAKE_USER
        ? { id: 'cus_Rd2i53yeQHNGYA' }
        : await createPaymentCustomer({
            organizationId: createdOrg.organizationId,
            email: args.email,
            name,
          });

    const [[createdProject]] = await Promise.all([
      db
        .insert(projects)
        .values({
          slug: 'default-project',
          name: 'Default Project',
          organizationId: createdOrg.organizationId,
        })
        .returning({
          id: projects.id,
        }),
      db.insert(organizationCredits).values({
        credits: '0',
        organizationId: createdOrg.organizationId,
      }),
      db.insert(organizationBillingDetails).values({
        organizationId: createdOrg.organizationId,
        stripeCustomerId,
        pricingModel: 'prepay',
      }),
    ]);

    await db.insert(organizationPreferences).values({
      organizationId: createdOrg.organizationId,
      defaultProjectId: createdProject.id,
    });
  } catch (e) {
    await AdminService.deleteOrganizationById({
      orgId: lettaAgentsOrganization.id,
    });

    await db
      .delete(organizations)
      .where(eq(organizations.id, createdOrg.organizationId));

    throw e;
  }

  return {
    ...createdOrg,
    lettaOrganizationId: lettaAgentsOrganization.id,
  };
}
