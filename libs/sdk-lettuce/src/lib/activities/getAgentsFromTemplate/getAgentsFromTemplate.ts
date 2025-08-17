import { and, eq } from 'drizzle-orm';
import {
  db,
  deployedAgentVariables,
  lettaTemplates,
} from '@letta-cloud/service-database';
import { AgentsService } from '@letta-cloud/sdk-core';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';

export interface GetAgentsFromTemplatePayload {
  templateId: string;
  organizationId: string;
  lettaAgentsId: string;
  limit?: number;
  after?: string;
  before?: string;
}

export interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

export async function getAgentsFromTemplate(
  payload: GetAgentsFromTemplatePayload,
): Promise<{ agents: AgentResponse[]; hasMore: boolean; nextCursor?: string }> {
  const {
    templateId,
    organizationId,
    lettaAgentsId,
    limit = 25,
    after,
    before,
  } = payload;

  try {
    console.log(
      `Getting agents from template ${templateId} (limit: ${limit}, after: ${after || 'none'}) for organization ${organizationId}`,
    );

    // Get the base template ID (the one with "current" version)
    const baseTemplate = await db.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.id, templateId),
      ),
      with: {
        project: true,
      },
    });

    if (!baseTemplate) {
      console.error(`Template ${templateId} not found`);
      return { agents: [], hasMore: false };
    }

    // Find the "current" version of this template
    const currentTemplate = await db.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.projectId, baseTemplate.projectId),
        eq(lettaTemplates.name, baseTemplate.name),
        eq(lettaTemplates.version, 'current'),
      ),
      columns: {
        id: true,
      },
    });

    if (!currentTemplate) {
      console.error(`Current template not found for ${baseTemplate.name}`);
      return { agents: [], hasMore: false };
    }

    // Get deployed agents using this base template ID with cursor-based pagination
    const deployedAgentsList = await AgentsService.listAgents(
      {
        baseTemplateId: currentTemplate.id,
        limit,
        after,
        before,
      },
      {
        user_id: lettaAgentsId,
      },
    );

    if (deployedAgentsList.length === 0) {
      console.log(
        `No agents found for template ${templateId} after cursor ${after || 'start'}`,
      );
      return { agents: [], hasMore: false };
    }

    console.log(
      `Found ${deployedAgentsList.length} agents for template ${templateId} after cursor ${after || 'start'}`,
    );

    // Get variables for all these agents
    const variables = await db.query.deployedAgentVariables.findMany({
      where: inArray(
        deployedAgentVariables.deployedAgentId,
        deployedAgentsList.map((v) => v.id),
      ),
    });

    const agents = variables.map(({ deployedAgentId, value }) => ({
      variables: value,
      agentId: deployedAgentId,
    }));

    // Determine if there are more agents to fetch and get next cursor
    const hasMore = deployedAgentsList.length === limit;
    const nextCursor =
      hasMore && deployedAgentsList.length > 0
        ? deployedAgentsList[deployedAgentsList.length - 1].id
        : undefined;

    return {
      agents,
      hasMore,
      nextCursor,
    };
  } catch (error) {
    console.error(`Failed to get agents from template ${templateId}:`, error);
    throw error;
  }
}
