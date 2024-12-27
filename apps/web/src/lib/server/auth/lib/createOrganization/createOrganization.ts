import { AdminService, ToolsService } from '@letta-web/letta-agents-api';
import {
  db,
  organizationPreferences,
  organizations,
  projects,
} from '@letta-web/database';

interface CreateOrganizationArgs {
  name: string;
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

  await ToolsService.addBaseTools(
    {
      userId: account.id,
    },
    {
      user_id: account.id,
    },
  );

  const [createdOrg] = await db
    .insert(organizations)
    .values({
      name,
      lettaAgentsId: lettaAgentsOrganization.id,
      enabledCloudAt: enableCloud ? new Date() : null,
    })
    .returning({ organizationId: organizations.id });

  const [createdProject] = await await db
    .insert(projects)
    .values({
      slug: 'default-project',
      name: 'Default Project',
      organizationId: createdOrg.organizationId,
    })
    .returning({
      id: projects.id,
    });

  await db.insert(organizationPreferences).values({
    organizationId: createdOrg.organizationId,
    defaultProjectId: createdProject.id,
  });

  return {
    ...createdOrg,
    lettaOrganizationId: lettaAgentsOrganization.id,
  };
}
