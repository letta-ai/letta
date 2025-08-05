import { AgentsService } from '@letta-cloud/sdk-core';
import type { CreateAgentData } from '@letta-cloud/sdk-core';
import { agentTemplates, db } from '@letta-cloud/service-database';
import {
  createSimulatedAgent,
  findUniqueAgentTemplateName,
  getTemplateProjectId,
} from '@letta-cloud/utils-server';
import { and, eq, isNull } from 'drizzle-orm';
import { cloudApiRouter } from '../router';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

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

  void trackServerSideEvent(AnalyticsEvent.CREATED_TEMPLATE, {
    userId: userId,
  });

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
        project_id: projectId,
        hidden: true,
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

  await Promise.all([
    cloudApiRouter.agents.versionAgentTemplate(
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
    ),
    createSimulatedAgent({
      memoryVariables: {},
      agentTemplateId: agent.id,
      organizationId,
      lettaAgentsId,
      projectId,
      isDefault: true,
    }),
  ]);

  return {
    templateName: name,
    templateId: agent.id,
  };
}
