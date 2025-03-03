import { AgentsService } from '@letta-cloud/sdk-core';
import type { CreateAgentData } from '@letta-cloud/sdk-core';
import { agentTemplates, db } from '@letta-cloud/service-database';
import { sdkRouter } from '$web/sdk/router';
import { findUniqueAgentTemplateName } from '$web/server';
import { and, eq, isNull } from 'drizzle-orm';

interface CreateTemplateOptions {
  projectId: string;
  name?: string;
  organizationId: string;
  lettaAgentsId: string;
  userId: string;
  createAgentState: Omit<
    CreateAgentData['requestBody'],
    | 'from_template'
    | 'name'
    | 'project_id'
    | 'project'
    | 'template_id'
    | 'template'
  >;
}

export async function createTemplate(props: CreateTemplateOptions) {
  const {
    projectId,
    name: preName,
    organizationId,
    lettaAgentsId,
    userId,
    createAgentState,
  } = props;

  if (preName) {
    if (!/^[a-zA-Z0-9_-]+$/.test(preName)) {
      throw new Error('Name must be alphanumeric');
    }

    const exists = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.projectId, projectId),
        eq(agentTemplates.name, preName),
        isNull(agentTemplates.deletedAt),
      ),
    });

    if (exists) {
      throw new Error('Name already exists');
    }
  }

  const name = preName || (await findUniqueAgentTemplateName());

  const agent = await AgentsService.createAgent(
    {
      requestBody: {
        ...createAgentState,
        name,
        project_id: `templates-${projectId}`,
      },
    },
    {
      user_id: lettaAgentsId,
    },
  );

  if (!agent.id) {
    throw new Error('Failed to create template');
  }

  await db.insert(agentTemplates).values({
    organizationId,
    name: name,
    id: agent.id,
    projectId: projectId,
  });

  await sdkRouter.agents.versionAgentTemplate(
    {
      params: {
        agent_id: agent.id,
      },
      body: {},
      query: {},
    },
    {
      request: {
        organizationId,
        lettaAgentsUserId: lettaAgentsId,
        userId,
        source: 'web',
      },
    },
  );

  return {
    templateName: name,
    templateId: agent.id,
  };
}
