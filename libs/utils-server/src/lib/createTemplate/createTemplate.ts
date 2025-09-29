import {
  db,
  lettaTemplates,
  projects,
  blockTemplate,
  agentTemplateBlockTemplates,
} from '@letta-cloud/service-database';
import type { TxType } from '@letta-cloud/service-database';
import { LettaTemplateTypes } from '@letta-cloud/sdk-core';
import type {
  AgentFileSchema,
  letta__schemas__agent_file__AgentSchema,
  LettaTemplateTypesType,
  BlockSchema,
  GroupSchema,
  GroupConfigurationType,
} from '@letta-cloud/sdk-core';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { and, eq } from 'drizzle-orm';
import { getNewTemplateName } from '../getNewTemplateName/getNewTemplateName';
import { createTemplateEntitiesFromAgentFileAgentSchema } from '../createTemplateEntitiesFromAgentState/createTemplateEntitiesFromAgentFileAgentSchema';
import { nanoid } from 'nanoid';
import { saveTemplate } from '@letta-cloud/utils-server';
import { mapToolsFromAgentFile } from '../mapToolsFromAgentFile/mapToolsFromAgentFile';
import { get } from 'lodash';

interface CreateTemplateOptions {
  tx?: TxType;
  base?: AgentFileSchema;
  projectId: string;
  organizationId: string;
  lettaAgentsId: string;
  name?: string;
  allowNameOverride?: boolean;
  userId: string;
  updateExistingTools?: boolean;
}

export const CREATE_TEMPLATE_ERRORS = {
  PROJECT_NOT_FOUND: 'Project with given ID not found',
  TOO_MANY_GROUPS: 'Agent files can only have 0 or 1 groups',
  TOO_MANY_SLEEPTIME_AGENTS:
    'Sleeptime groups can only have up to 2 agents (one sleeptime and one main)',
  INVALID_SLEEPTIME_AGENTS:
    'Sleeptime groups must have exactly one sleeptime_agent and one memgpt_v2_agent',
  INVALID_GROUP_CONFIG:
    'Group was not provided or manager type was not included in group',
  UNSUPPORTED_GROUP_TYPE: 'Group type is not supported',
  MISSING_MANAGER_ENTITY_ID: 'Missing manager entity id',
  NO_MANAGER_PROVIDED: 'No manager was provided',
  TOO_MANY_MANAGERS:
    'There are too many group managers provided in this schema, we only support (1)',
  TOOLS_MISSING_JSON_CONFIG: 'One or more custom tools provided are missing json_schema configuration',
  TOOL_CREATION_FAILED: 'Failed to create one or more custom tools',
};

export function determineTemplateType(
  base?: AgentFileSchema,
): LettaTemplateTypesType {
  if (!base) return 'dynamic';

  const groupCount = base.groups?.length ?? 0;
  const agentCount = base.agents?.length ?? 0;

  // Validate groups constraint
  if (groupCount > 1) {
    throw new Error(CREATE_TEMPLATE_ERRORS.TOO_MANY_GROUPS);
  }

  // Single agent with no groups = classic
  if (agentCount === 1 && groupCount === 0) {
    return 'classic';
  }

  if (agentCount > 1 && groupCount === 0) {
    return 'cluster';
  }

  // Has groups - check first group type
  const firstGroup = base.groups[0];

  if (!firstGroup) {
    throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
  }

  // Check if it's a sleeptime or voice_sleeptime group
  if (firstGroup.manager_config?.manager_type === 'sleeptime') {
    // Validate sleeptime constraints
    if (agentCount > 2) {
      throw new Error(CREATE_TEMPLATE_ERRORS.TOO_MANY_SLEEPTIME_AGENTS);
    }
    return 'sleeptime';
  }

  if (firstGroup.manager_config?.manager_type === 'voice_sleeptime') {
    // Voice sleeptime works the same as sleeptime - limited to 2 agents
    if (agentCount > 2) {
      throw new Error(CREATE_TEMPLATE_ERRORS.TOO_MANY_SLEEPTIME_AGENTS);
    }
    return 'voice_sleeptime';
  }

  if (!firstGroup.manager_config?.manager_type) {
    throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
  }

  // check if group type is supported
  const safeLetta = LettaTemplateTypes.safeParse(
    firstGroup.manager_config.manager_type,
  );

  if (safeLetta.error) {
    throw new Error(CREATE_TEMPLATE_ERRORS.UNSUPPORTED_GROUP_TYPE);
  }

  // Default to dynamic for other cases
  return safeLetta.data;
}

export function setGroupConfiguration(
  templateType: LettaTemplateTypesType,
  groups?: GroupSchema[],
  managerEntityId?: string,
): GroupConfigurationType | null {
  if (!groups?.length) {
    return null;
  }

  const group = groups[0];
  const managerConfig = group.manager_config;

  switch (templateType) {
    case 'sleeptime': {
      if (managerConfig?.manager_type !== 'sleeptime') {
        throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
      }

      if (!managerEntityId) {
        throw new Error(CREATE_TEMPLATE_ERRORS.MISSING_MANAGER_ENTITY_ID);
      }

      return {
        managerAgentEntityId: managerEntityId,
        sleeptimeAgentFrequency: managerConfig.sleeptime_agent_frequency || 15,
      };
    }
    case 'voice_sleeptime': {
      if (managerConfig?.manager_type !== 'voice_sleeptime') {
        throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
      }

      if (!managerEntityId) {
        throw new Error(CREATE_TEMPLATE_ERRORS.MISSING_MANAGER_ENTITY_ID);
      }

      return {
        managerAgentEntityId: managerEntityId,
        maxMessageBufferLength: managerConfig.max_message_buffer_length || 15,
        minMessageBufferLength: managerConfig.min_message_buffer_length || 15,
      };
    }
    case 'supervisor': {
      if (managerConfig?.manager_type !== 'supervisor') {
        throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
      }

      return {
        managerAgentEntityId: managerEntityId,
      };
    }
    case 'dynamic': {
      if (managerConfig?.manager_type !== 'dynamic') {
        throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
      }

      return {
        managerAgentEntityId: managerEntityId,
        terminationToken: managerConfig.termination_token || 'END',
        maxTurns: managerConfig.max_turns || 15,
      };
    }
    case 'round_robin': {
      if (managerConfig?.manager_type !== 'round_robin') {
        throw new Error(CREATE_TEMPLATE_ERRORS.INVALID_GROUP_CONFIG);
      }

      return {
        maxTurns: managerConfig.max_turns || 15,
      };
    }
    case 'classic': {
      // Classic templates typically don't have group configurations
      return null;
    }
    default: {
      // For any future template types, return basic config
      return {};
    }
  }
}

export async function processBlocks(
  blocks: BlockSchema[],
  agents: letta__schemas__agent_file__AgentSchema[],
  tx: TxType,
  organizationId: string,
  projectId: string,
  lettaTemplateId: string,
): Promise<Record<string, string>> {
  // Map from original block ID to created block template ID
  const blockIdMapping: Record<string, string> = {};

  // Get all block IDs referenced by agents
  const referencedBlockIds = new Set<string>();
  for (const agent of agents) {
    if (agent.block_ids) {
      agent.block_ids.forEach((blockId) => referencedBlockIds.add(blockId));
    }
  }

  // Only process blocks that are referenced by at least one agent
  const referencedBlocks = blocks.filter((block) =>
    referencedBlockIds.has(block.id),
  );

  for (const block of referencedBlocks) {
    const [createdBlock] = await tx
      .insert(blockTemplate)
      .values({
        entityId: block.id || nanoid(8),
        organizationId,
        value: block.value,
        lettaTemplateId,
        label: block.label,
        projectId,
        limit: block.limit ?? 8000,
        description: block.description ?? '',
        preserveOnMigration: block.preserve_on_migration ?? null,
        readOnly: block.read_only ?? false,
      })
      .returning({ id: blockTemplate.id });

    blockIdMapping[block.id] = createdBlock.id;
  }

  return blockIdMapping;
}

export async function createAgentBlockAssociations(
  agentTemplateId: string,
  blockIds: string[],
  blockIdMapping: Record<string, string>,
  tx: TxType,
  lettaTemplateId: string,
  blocks: BlockSchema[],
) {
  for (const blockId of blockIds) {
    const blockTemplateId = blockIdMapping[blockId];
    if (!blockTemplateId) {
      continue; // Skip if block wasn't created
    }

    const block = blocks.find((b) => b.id === blockId);
    if (!block) {
      continue;
    }

    await tx
      .insert(agentTemplateBlockTemplates)
      .values({
        lettaTemplateId,
        agentTemplateSchemaId: agentTemplateId,
        blockTemplateId,
        blockLabel: block.label,
      })
      .onConflictDoNothing();
  }
}

export async function createTemplate(options: CreateTemplateOptions) {
  const {
    projectId,
    organizationId,
    allowNameOverride,
    name: suggestedName,
    lettaAgentsId,
    userId,
    base,
    tx,
    updateExistingTools = false,
  } = options;

  // Get project
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.id, projectId),
    ),
  });

  if (!project) {
    throw new Error(CREATE_TEMPLATE_ERRORS.PROJECT_NOT_FOUND);
  }

  void trackServerSideEvent(AnalyticsEvent.CREATED_TEMPLATE, {
    user_id: userId,
  });

  const templateType = determineTemplateType(base);

  if (base?.tools) {
    // Validate that all custom tools have json_schema
    for (const tool of base.tools) {
      if (tool.tool_type ==='custom' && tool.source_code && !tool.json_schema) {
        throw new Error(CREATE_TEMPLATE_ERRORS.TOOLS_MISSING_JSON_CONFIG);
      }
    }
  }

  async function executeInTransaction(tx: TxType) {
    const name = await getNewTemplateName({
      organizationId,
      projectId,
      suggestedName,
      allowNameOverride,
      tx,
    });

    let mainAgentEntityId = nanoid(8);

    if (base?.groups?.[0]?.manager_config && 'manager_agent_id' in base.groups[0].manager_config) {
      mainAgentEntityId = base.groups[0].manager_config.manager_agent_id;
    }


    // Create tool mapping from agent file tools to server tool IDs
    let toolMapping: Record<string, string> = {};
    if (base) {
      try {
        toolMapping = await mapToolsFromAgentFile({
          base,
          lettaAgentsId,
          updateExistingTools,
        });
      } catch (_) {
        // If tool creation fails, throw a specific error
        throw new Error(CREATE_TEMPLATE_ERRORS.TOOL_CREATION_FAILED);
      }
    }

    // Create the letta template first
    const [lettaTemplateResult] = await tx
      .insert(lettaTemplates)
      .values({
        name: name,
        organizationId,
        projectId,
        version: 'current',
        description: '',
        message: '',
        groupConfiguration: setGroupConfiguration(
          templateType,
          base?.groups,
          mainAgentEntityId,
        ),
        type: templateType,
      })
      .returning();

    // Process blocks if they exist
    let blockIdMapping: Record<string, string> = {};
    if (base?.blocks?.length && base?.agents?.length) {
      blockIdMapping = await processBlocks(
        base.blocks,
        base.agents,
        tx,
        organizationId,
        projectId,
        lettaTemplateResult.id,
      );
    }

    // Process agents based on template type
    if (base?.agents?.length) {
      switch (templateType) {
        case 'sleeptime':
        case 'voice_sleeptime': {
          let sleeptimeAgentEntityId = nanoid(8);

          // Handle sleeptime template with specific agent types
          const mainAgent = base.agents.find(
            (agent) =>
              agent.agent_type === 'memgpt_v2_agent' ||
              agent.agent_type === 'memgpt_agent' ||
              agent.agent_type === 'voice_convo_agent',
          );
          const sleeptimeAgent = base.agents.find(
            (agent) =>
              agent.agent_type === 'sleeptime_agent' ||
              agent.agent_type === 'voice_sleeptime_agent',
          );

          if (sleeptimeAgent?.id) {
            sleeptimeAgentEntityId = sleeptimeAgent.id;
          }

          // Create agent templates
          const [mainAgentTemplate, sleeptimeAgentTemplate] = await Promise.all(
            [
              createTemplateEntitiesFromAgentFileAgentSchema({
                entityId: mainAgentEntityId,
                agentSchema: {
                  id: '',
                  agent_type: 'memgpt_v2_agent',
                  ...mainAgent,
                },
                organizationId,
                lettaTemplateId: lettaTemplateResult.id,
                projectId,
                tx,
                toolMapping,
              }),
              createTemplateEntitiesFromAgentFileAgentSchema({
                agentSchema: {
                  id: '',
                  agent_type: 'sleeptime_agent',
                  ...sleeptimeAgent,
                },
                entityId: sleeptimeAgentEntityId,
                organizationId,
                lettaTemplateId: lettaTemplateResult.id,
                projectId,
                tx,
                toolMapping,
              }),
            ],
          );

          // Create block associations for both agents
          if (mainAgent?.block_ids?.length) {
            await createAgentBlockAssociations(
              mainAgentTemplate.id,
              mainAgent.block_ids,
              blockIdMapping,
              tx,
              lettaTemplateResult.id,
              base.blocks || [],
            );
          }

          if (sleeptimeAgent?.block_ids?.length) {
            await createAgentBlockAssociations(
              sleeptimeAgentTemplate.id,
              sleeptimeAgent.block_ids,
              blockIdMapping,
              tx,
              lettaTemplateResult.id,
              base.blocks || [],
            );
          }
          break;
        }
        case 'classic': {
          const mainAgent = base.agents.find(
            (agent) =>
              agent.agent_type !== 'sleeptime_agent' &&
              agent.agent_type !== 'voice_sleeptime_agent',
          );

          const agentTemplate =
            await createTemplateEntitiesFromAgentFileAgentSchema({
              agentSchema: mainAgent,
              entityId: mainAgent?.id,
              organizationId,
              lettaTemplateId: lettaTemplateResult.id,
              projectId,
              tx,
              toolMapping,
            });

          // Create block associations for classic agent
          if (mainAgent?.block_ids?.length) {
            await createAgentBlockAssociations(
              agentTemplate.id,
              mainAgent.block_ids,
              blockIdMapping,
              tx,
              lettaTemplateResult.id,
              base.blocks || [],
            );
          }
          break;
        }
        case 'cluster':
        case 'dynamic':
        case 'round_robin':
        case 'supervisor': {
          // there should only be one managing entity
          if (templateType !== 'round_robin' && templateType !== 'cluster') {
            const agentsThatManage = base.agents.filter(
              (v) => (v.group_ids || [])?.length > 0,
            );

            if (agentsThatManage.length > 1) {
              throw new Error(CREATE_TEMPLATE_ERRORS.TOO_MANY_MANAGERS);
            }

            if (agentsThatManage.length === 0) {
              throw new Error(CREATE_TEMPLATE_ERRORS.NO_MANAGER_PROVIDED);
            }
          }

          const mainAgentId = get(base.groups, '[0].manager_config.manager_agent_id', null) as string | null;
          const hasMainAgentId = !!(mainAgentId && base.agents.find((a) => a.id === mainAgentId));

          let index = 0;
          // Handle multi-agent templates - create templates for all agents (unlimited agents allowed)
          for (const agent of base.agents) {
            const agentTemplate =
              await createTemplateEntitiesFromAgentFileAgentSchema({
                agentSchema: agent,
                organizationId,
                lettaTemplateId: lettaTemplateResult.id,
                projectId,
                tx,
                toolMapping,
                entityId: (hasMainAgentId && agent.id === mainAgentId) || (!hasMainAgentId && index === 0) ? mainAgentEntityId : agent.id,
              });

            // Create block associations for each agent
            if (agent?.block_ids?.length) {
              await createAgentBlockAssociations(
                agentTemplate.id,
                agent.block_ids,
                blockIdMapping,
                tx,
                lettaTemplateResult.id,
                base.blocks || [],
              );
            }

            index++;
          }
          break;
        }
        default:
          throw new Error(CREATE_TEMPLATE_ERRORS.UNSUPPORTED_GROUP_TYPE);
      }
    }

    if (!project) {
      throw new Error(CREATE_TEMPLATE_ERRORS.PROJECT_NOT_FOUND);
    }

    const lettaTemplate = await saveTemplate({
      organizationId,
      lettaAgentsId,
      projectSlug: project.slug,
      templateName: name,
      message: 'Init',
      tx,
    });

    return {
      lettaTemplate,
      projectSlug: project.slug,
    };
  }

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeInTransaction(tx);
  } else {
    return db.transaction(executeInTransaction);
  }
}
