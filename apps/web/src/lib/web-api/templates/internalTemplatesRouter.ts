import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { getUserOrThrow } from '$web/server/auth';
import { and, eq, isNull } from 'drizzle-orm';
import {
  db,
  lettaTemplates,
  agentTemplateV2,
} from '@letta-cloud/service-database';
import type { agentTemplateV2 as AgentTemplateV2Table } from '@letta-cloud/service-database';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  convertV1AgentTemplateToV2Agent
} from '@letta-cloud/utils-server';
import type { AgentTemplateSchemaResponse } from '@letta-cloud/utils-shared';

type GetAgentTemplateByEntityIdRequest = ServerInferRequest<
  typeof contracts.templates.getAgentTemplateByEntityId
>;

type GetAgentTemplateByEntityIdResponse = ServerInferResponses<
  typeof contracts.templates.getAgentTemplateByEntityId
>;

export function convertAgentTemplateToPayload(
  agentTemplate: typeof AgentTemplateV2Table.$inferSelect,
): AgentTemplateSchemaResponse {
  return {
    id: agentTemplate.id,
    name: agentTemplate.name,
    agentType: agentTemplate.agentType,
    entityId: agentTemplate.entityId,
    organizationId: agentTemplate.organizationId,
    projectId: agentTemplate.projectId,
    lettaTemplateId: agentTemplate.lettaTemplateId,
    memoryVariables: agentTemplate.memoryVariables || null,
    tags: agentTemplate.tags || null,
    identityIds: agentTemplate.identityIds || null,
    toolIds: agentTemplate.toolIds || null,
    toolRules: agentTemplate.toolRules || null,
    sourceIds: agentTemplate.sourceIds || null,
    model: agentTemplate.model,
    toolVariables: agentTemplate.toolVariables || null,
    systemPrompt: agentTemplate.systemPrompt,
    properties: agentTemplate.properties || null,
    createdAt: agentTemplate.createdAt.toISOString(),
    updatedAt: agentTemplate.updatedAt.toISOString(),
  };
}

export async function getAgentTemplateByEntityId(
  req: GetAgentTemplateByEntityIdRequest,
): Promise<GetAgentTemplateByEntityIdResponse> {
  const { templateId, entityId } = req.params;
  const { activeOrganizationId, permissions, lettaAgentsId } = await getUserOrThrow();

  if (!activeOrganizationId) {
    return {
      status: 404,
      body: { error: 'Organization not found' },
    };
  }

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: { error: 'Insufficient permissions' },
    };
  }

  // First, find the letta template to check its type
  const lettaTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.id, templateId),
      eq(lettaTemplates.organizationId, activeOrganizationId),
      isNull(lettaTemplates.deletedAt),
    ),
  });

  if (!lettaTemplate) {
    return {
      status: 404,
      body: { error: 'Template not found' },
    };
  }

  let agentTemplate;

  if (lettaTemplate.type === 'classic' || entityId === 'default') {
    await convertV1AgentTemplateToV2Agent({
      agentTemplateId: lettaTemplate.id,
      organizationId: activeOrganizationId,
      lettaAgentsId: lettaAgentsId,
      projectId: lettaTemplate.projectId,
    });


    // For classic templates, return the first agentTemplateV2 regardless of entityId
    agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: and(
        eq(agentTemplateV2.lettaTemplateId, templateId),
        eq(agentTemplateV2.organizationId, activeOrganizationId),
      ),
    });
  } else {
    // For non-classic templates, use the entityId to find the specific agent template
    agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: and(
        eq(agentTemplateV2.lettaTemplateId, templateId),
        eq(agentTemplateV2.entityId, entityId),
        eq(agentTemplateV2.organizationId, activeOrganizationId),
      ),
    });
  }

  if (!agentTemplate) {
    return {
      status: 404,
      body: { error: 'Agent template not found' },
    };
  }

  return {
    status: 200,
    body: convertAgentTemplateToPayload(agentTemplate),
  };
}

export const internalTemplatesRouter = {
  getAgentTemplateByEntityId,
};
