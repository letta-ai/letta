import { db, lettaTemplates, projects } from '@letta-cloud/service-database';
import { findUniqueAgentTemplateName } from '../findUniqueAgentTemplateName/findUniqueAgentTemplateName';
import { and, eq } from 'drizzle-orm';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { createTemplateEntitiesFromAgentState } from '../createTemplateEntitiesFromAgentState/createTemplateEntitiesFromAgentState';
import { saveTemplate } from '../saveTemplateVersion/saveTemplate';
import type { AgentStateForSynchronization } from '@letta-cloud/utils-shared';
import { DEFAULT_SYSTEM_PROMPT } from '@letta-cloud/types';

interface CreateTemplateOptions {
  projectId: string;
  organizationId: string;
  lettaAgentsId: string;
  userId: string;
  allowNameOverride?: boolean;
  name?: string;
  agentState: AgentStateForSynchronization;
}

export async function createTemplateFromAgentState(
  props: CreateTemplateOptions,
) {
  const {
    projectId,
    organizationId,
    allowNameOverride,
    lettaAgentsId,
    userId,
    agentState,
  } = props;

  let {
    name: preName,
  } = props;

  // get project
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.id, projectId),
    ),
  });

  if (!project) {
    throw new Error(
      `Project with ID ${projectId} not found in organization ${organizationId}`,
    );
  }

  void trackServerSideEvent(AnalyticsEvent.CREATED_TEMPLATE, {
    user_id: userId,
  });

  if (preName) {
    if (!/^[a-zA-Z0-9_-]+$/.test(preName)) {
      throw new Error('Name must be alphanumeric');
    }

    const exists = await db.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.projectId, projectId),
        eq(lettaTemplates.name, preName),
      ),
    });

    if (exists) {
      if (allowNameOverride) {
        preName = await findUniqueAgentTemplateName();
      } else {
        throw new Error('Name already exists');
      }
    }
  }

  const name = preName || (await findUniqueAgentTemplateName());

  const lettaTemplate = await db.transaction(async (tx) => {
    const [lettaTemplate] = await tx
      .insert(lettaTemplates)
      .values({
        name,
        organizationId,
        projectId,
        version: 'current',
        description: '',
        message: '',
        groupConfiguration: {},
        type: 'classic',
      })
      .returning();

    // create entities
    await createTemplateEntitiesFromAgentState({
      tx,
      agentState: {
        ...agentState,
        system: agentState.system || DEFAULT_SYSTEM_PROMPT,
        llm_config: {
          ...agentState.llm_config,
          handle: agentState.llm_config.handle || 'openai/gpt-4o-mini',
        },
      },
      organizationId,
      lettaTemplateId: lettaTemplate.id,
      projectId,
    });

    return await saveTemplate({
      organizationId,
      lettaAgentsId,
      projectSlug: project.slug,
      templateName: name,
      message: 'Init',
      tx,
    });
  });

  return {
    lettaTemplate,
    projectSlug: project.slug,
  };
}
