import type { AgentStateForSynchronization } from '@letta-cloud/utils-shared';
import {
  attachMemoryVariablesToBlockValue,
  convertMemoryVariablesV1ToRecordMemoryVariables,
} from '@letta-cloud/utils-shared';
import {
  agentTemplateBlockTemplates, deployment,
  lettaTemplates
} from '@letta-cloud/service-database';
import {
  agentTemplateV2,
  blockTemplate,
  db,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import {
  type Group,
  type InternalTemplateAgentCreate,
  type InternalTemplateBlockCreate,
  type InternalTemplateGroupCreate,
  InternalTemplatesService
} from '@letta-cloud/sdk-core';
import type { CreateAgentRequest, GroupCreate } from '@letta-cloud/sdk-core';
import { isAPIError } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';

import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { DEFAULT_EMBEDDING_CONFIG } from '@letta-cloud/types';
import { createCachedLLMConfigRetriever } from '../getCachedLLMConfig/getCachedLLMConfig';

interface Overrides {
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  tags?: AgentStateForSynchronization['tags'];
  name?: string;
  initialMessageSequence?: CreateAgentRequest['initial_message_sequence'];
  identityIds?: string[];
  hidden?: boolean;
}

interface CreateEntitiesFromTemplateOptions {
  projectId: string;
  organizationId: string;
  lettaAgentsId: string;
  template: typeof lettaTemplates.$inferSelect;
  overrides: Overrides;
}

export const CreateEntitiesFromTemplateErrors = {
  TEMPLATE_TYPE_NOT_SUPPORTED: 'This template type is not supported',
  TEMPLATE_CORRUPTED: 'This template was corrupted, contact support',
  NO_ROOT_TEMPLATE: 'No root template found',
  CORE_ERROR: 'There was an critical error, contact support',
  FAILED_TO_CREATE_AGENT: 'Failed to create agent, contact support',
};

export async function createEntitiesFromTemplate(
  options: CreateEntitiesFromTemplateOptions,
) {
  const { projectId, lettaAgentsId, organizationId, template, overrides } = options;

  const [agentTemplates, blockTemplates, baseTemplate, agentBlockAssociations] =
    await Promise.all([
      db.query.agentTemplateV2.findMany({
        where: eq(agentTemplateV2.lettaTemplateId, template.id),
      }),
      db.query.blockTemplate.findMany({
        where: eq(blockTemplate.lettaTemplateId, template.id),
      }),
      db.query.lettaTemplates.findFirst({
        where: and(
          eq(lettaTemplates.name, template.name),
          eq(lettaTemplates.projectId, projectId),
          eq(lettaTemplates.version, 'current'),
        ),
        columns: {
          id: true,
          type: true,
          groupConfiguration: true,
        },
      }),
      db.query.agentTemplateBlockTemplates.findMany({
        where: eq(agentTemplateBlockTemplates.lettaTemplateId, template.id),
        with: {
          blockTemplate: {
            columns: {
              entityId: true,
            },
          },
          agentTemplate: {
            columns: {
              entityId: true,
            },
          },
        },
      }),
    ]);

  if (!baseTemplate) {
    throw new Error(CreateEntitiesFromTemplateErrors.NO_ROOT_TEMPLATE);
  }

  if (agentTemplates.length === 0) {
    throw new Error(CreateEntitiesFromTemplateErrors.TEMPLATE_CORRUPTED);
  }

  const [currentDeployment] = await db.insert(deployment).values({
    projectId,
    organizationId,
    baseTemplateId: baseTemplate.id,
    lettaTemplateId: template.id,
    status: 'initiated',
  }).returning({
    id: deployment.id,
  })

  try {
    const deploymentId = currentDeployment.id;

    const memoryBlocks: InternalTemplateBlockCreate[] = blockTemplates.map(
      (block) => ({
        value: overrides.memoryVariables
          ? attachMemoryVariablesToBlockValue(
            block.value,
            overrides.memoryVariables,
          )
          : block.value,
        limit: block.limit,
        label: block.label,
        hidden: overrides.hidden,
        entity_id: block.entityId,
        deployment_id: deploymentId,
        base_template_id: baseTemplate.id,
        template_id: template.id,
        description: block.description,
        preserve_on_migration: block.preserveOnMigration || false,
        read_only: block.readOnly || false,
        project_id: projectId,
      }),
    );

    const entityToIdBlockMap: Map<string, string> = new Map();

    await Promise.all(
      memoryBlocks.map(async (inputBlock) => {
        const createdBlock =
          await InternalTemplatesService.createInternalTemplateBlock(
            {
              requestBody: inputBlock,
            },
            {
              user_id: lettaAgentsId,
            },
          ).catch((error) => {
            if (isAPIError(error)) {
              console.log(error.body);
              Sentry.captureException(error, {
                extra: {
                  template: template.name,
                  body: error.body,
                },
              });
            } else {
              Sentry.captureException(error, {
                extra: {
                  template: template.name,
                },
              });
            }

            throw new Error(CreateEntitiesFromTemplateErrors.CORE_ERROR);
          });
        if (createdBlock.id) {
          entityToIdBlockMap.set(inputBlock.entity_id, createdBlock.id);
        }
      }),
    );

    const llmRetriever = createCachedLLMConfigRetriever(lettaAgentsId);


    const agentEntityIdToAgentIdMap: Map<string, string> = new Map();

    const agents = await Promise.all(
      agentTemplates.map(async (agentTemplate, index) => {
        // get initial tool variables form the template, the merge the overrides
        const initialToolVariables = agentTemplate.toolVariables
          ? convertMemoryVariablesV1ToRecordMemoryVariables(
            agentTemplate.toolVariables,
          )
          : {};
        const finalToolVariables = {
          ...initialToolVariables,
          ...overrides.toolVariables,
        };

        let llmConfig = await llmRetriever.getCachedLLMConfig(agentTemplate.model);

        if (!llmConfig) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(CreateEntitiesFromTemplateErrors.CORE_ERROR);
          } else {
            const allModels = await llmRetriever.getAllCachedLLMConfigs();

            if (allModels.length === 0) {
              throw new Error(
                'No LLMs found in your organization, please add one before creating agents',
              );
            }

            llmConfig = allModels[0];
          }
        }

        llmConfig.max_tokens =
          agentTemplate.properties?.max_tokens || llmConfig.max_tokens;
        llmConfig.temperature =
          agentTemplate.properties?.temperature || llmConfig.temperature;
        llmConfig.context_window =
          agentTemplate.properties?.context_window_limit ||
          llmConfig.context_window;
        llmConfig.max_reasoning_tokens =
          agentTemplate.properties?.max_reasoning_tokens ||
          llmConfig.max_reasoning_tokens;

        llmConfig.verbosity =
          agentTemplate.properties?.verbosity_level || llmConfig.verbosity;
        llmConfig.reasoning_effort =
          agentTemplate.properties?.reasoning_effort ||
          llmConfig.reasoning_effort;

        const blockIds =
          agentBlockAssociations
            ?.map((association) => {
              // get blockEntityId and agentTemplateEntityId
              const blockEntityId = association.blockTemplate.entityId;
              const agentTemplateEntityId = association.agentTemplate.entityId;

              if (agentTemplateEntityId === agentTemplate.entityId) {
                const blockId = entityToIdBlockMap.get(blockEntityId);
                if (blockId) {
                  return blockId;
                }
              }
            })
            .filter((id): id is string => !!id) || [];
        // override name only works for first agent
        const customName = index === 0 ? overrides.name : undefined;

        // Create the agent
        const createAgentRequest: InternalTemplateAgentCreate = {
          project_id: projectId,
          name:
            customName ||
            uniqueNamesGenerator({
              dictionaries: [adjectives, colors, animals],
              length: 3,
              separator: '-',
            }),
          deployment_id: deploymentId,
          entity_id: agentTemplate.entityId,
          system: agentTemplate.systemPrompt,
          llm_config: llmConfig,
          tool_ids: agentTemplate.toolIds || [],
          block_ids: blockIds,
          tool_rules: agentTemplate.toolRules || [],
          source_ids: agentTemplate.sourceIds || [],
          tags: overrides.tags || agentTemplate.tags,
          identity_ids: overrides.identityIds || agentTemplate.identityIds,
          initial_message_sequence: overrides.initialMessageSequence,
          tool_exec_environment_variables: finalToolVariables,
          hidden: overrides.hidden || false,
          include_base_tools: false,
          include_base_tool_rules: false,
          include_multi_agent_tools: false,
          include_default_source: false,
          embedding_config: DEFAULT_EMBEDDING_CONFIG,
          max_files_open: agentTemplate.properties?.max_files_open,
          reasoning:
            agentTemplate.properties?.enable_reasoner ||
            agentTemplate.properties?.put_inner_thoughts_in_kwargs,
          per_file_view_window_char_limit:
          agentTemplate.properties?.per_file_view_window_char_limit,
          template_id: template.id,
          base_template_id: baseTemplate.id,
        };

        const newAgent = await InternalTemplatesService.createInternalTemplateAgent(
          {
            requestBody: createAgentRequest,
          },
          {
            user_id: lettaAgentsId,
          },
        ).catch((error) => {
          if (isAPIError(error)) {
            console.log(error.body)

            Sentry.captureException(error, {
              extra: {
                template: template.name,
                body: error.body,
              },
            });
          } else {
            Sentry.captureException(error, {
              extra: {
                template: template.name,
              },
            });
          }

          throw new Error(
            CreateEntitiesFromTemplateErrors.FAILED_TO_CREATE_AGENT,
          );
        });

        if (newAgent && newAgent.id) {
          agentEntityIdToAgentIdMap.set(agentTemplate.entityId, newAgent.id);
        }

        return newAgent;
      }),
    );

    let group: Group | null = null;

    if (baseTemplate.type !== 'classic' && baseTemplate.type !== 'cluster') {
      // create a group
      function mapTypeToGroupConfig(): GroupCreate['manager_config'] {
        if (!baseTemplate) {
          throw new Error(CreateEntitiesFromTemplateErrors.NO_ROOT_TEMPLATE);
        }

        const managerAgentId =
          template.groupConfiguration &&
          'managerAgentEntityId' in template.groupConfiguration &&
          template.groupConfiguration.managerAgentEntityId
            ? agentEntityIdToAgentIdMap.get(
              template.groupConfiguration.managerAgentEntityId,
            )
            : null;

        switch (baseTemplate.type) {
          case 'dynamic':
            if (!managerAgentId) {
              throw new Error(
                'Dynamic groups require a manager agent, please check your template configuration',
              );
            }

            return {
              manager_type: 'dynamic',
              manager_agent_id: managerAgentId,
              termination_token:
                template.groupConfiguration?.terminationToken || 'stop',
              max_turns: template.groupConfiguration?.maxTurns || 15,
            };
          case 'supervisor':
            if (!managerAgentId) {
              throw new Error(
                'Supervisor groups require a manager agent, please check your template configuration',
              );
            }

            return {
              manager_type: 'supervisor',
              manager_agent_id: managerAgentId,
            };
          case 'round_robin':
            return {
              manager_type: 'round_robin',
              max_turns: template.groupConfiguration?.maxTurns || 15,
            };
          case 'voice_sleeptime':
            if (!managerAgentId) {
              throw new Error(
                'Voice sleeptime groups require a manager agent, please check your template configuration',
              );
            }
            return {
              manager_type: 'voice_sleeptime',
              manager_agent_id: managerAgentId,
              max_message_buffer_length:
                template.groupConfiguration?.maxMessageBufferLength || 15,
              min_message_buffer_length:
                template.groupConfiguration?.minMessageBufferLength || 15,
            };
          case 'sleeptime':
            if (!managerAgentId) {
              throw new Error(
                'Sleeptime groups require a manager agent, please check your template configuration',
              );
            }

            return {
              manager_type: 'sleeptime',
              manager_agent_id: managerAgentId,
              sleeptime_agent_frequency:
                template.groupConfiguration?.sleeptimeAgentFrequency || 15,
            };
          default:
            return {};
        }
      }

      const groupCreate: InternalTemplateGroupCreate = {
        project_id: projectId,
        base_template_id: baseTemplate.id,
        template_id: template.id,
        deployment_id: deploymentId,
        hidden: overrides.hidden,
        description: `Group for template ${template.name}`,
        manager_config: mapTypeToGroupConfig(),
        agent_ids: [...agentEntityIdToAgentIdMap.values()],
      };

      group = await InternalTemplatesService.createInternalTemplateGroup(
        {
          requestBody: groupCreate,
        },
        {
          user_id: lettaAgentsId,
        },
      );
    }

    // mark the deployment as successful
    await db.update(deployment).set({
      status: 'ready',
    }).where(eq(deployment.id, currentDeployment.id));

    return {
      agents,
      group,
      deploymentId,
    };
  } catch (e) {
    // if we have a deploymentId, we should delete it
    void InternalTemplatesService.deleteDeployment({
      deploymentId: currentDeployment.id,
    }, {
      user_id: lettaAgentsId,
    }).catch((e) => {
      Sentry.captureException(e);
    });

    // mark the deployment as failed
    await db.update(deployment).set({
      status: 'failed',
      statusMessage: e instanceof Error ? e.message : 'Unknown error',
    }).where(eq(deployment.id, currentDeployment.id));

    throw e;
  }
}
