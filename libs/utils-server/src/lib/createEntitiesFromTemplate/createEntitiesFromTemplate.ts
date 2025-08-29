import type { AgentStateForSynchronization } from '@letta-cloud/utils-shared';
import {
  attachMemoryVariablesToBlockValue,
  convertMemoryVariablesV1ToRecordMemoryVariables,
} from '@letta-cloud/utils-shared';
import { lettaTemplates } from '@letta-cloud/service-database';
import {
  agentTemplateV2,
  blockTemplate,
  db,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { AgentsService } from '@letta-cloud/sdk-core';
import { LlmsService } from '@letta-cloud/sdk-core';
import type { CreateAgentRequest, CreateBlock } from '@letta-cloud/sdk-core';
import { isAPIError } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';

import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';

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
  lettaAgentsId: string;
  template: typeof lettaTemplates.$inferSelect;
  overrides: Overrides;
}

export enum CreateEntitiesFromTemplateErrors {
  TEMPLATE_TYPE_NOT_SUPPORTED = 'TEMPLATE_TYPE_NOT_SUPPORTED',
  TEMPLATE_CORRUPTED = 'TEMPLATE_CORRUPTED',
  NO_ROOT_TEMPLATE = 'NO_ROOT_TEMPLATE',
  CORE_ERROR = 'CORE_ERROR',
}

export async function createEntitiesFromTemplate(
  options: CreateEntitiesFromTemplateOptions,
) {
  const { projectId, lettaAgentsId, template, overrides } = options;

  const { type } = template;

  if (type !== 'classic') {
    throw new Error(
      CreateEntitiesFromTemplateErrors.TEMPLATE_TYPE_NOT_SUPPORTED,
    );
  }

  const [agentTemplate, blockTemplates, baseTemplate] = await Promise.all([
    db.query.agentTemplateV2.findFirst({
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
        id: true
      }
    }),
  ]);

  if (!baseTemplate) {
    throw new Error(CreateEntitiesFromTemplateErrors.NO_ROOT_TEMPLATE);
  }

  if (!agentTemplate) {
    throw new Error(CreateEntitiesFromTemplateErrors.TEMPLATE_CORRUPTED);
  }

  const memoryBlocks: CreateBlock[] = blockTemplates.map((block) => ({
    value: overrides.memoryVariables
      ? attachMemoryVariablesToBlockValue(
          block.value,
          overrides.memoryVariables,
        )
      : block.value,
    limit: block.limit,
    label: block.label,
    description: block.description,
    preserve_on_migration: block.preserveOnMigration || false,
    read_only: block.readOnly || false,
    project_id: projectId,
  }));

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

  const llms = await LlmsService.listModels({}, {
    user_id: lettaAgentsId,
  })

  let llmConfig = llms.find(
    (model) => model.handle === agentTemplate.model,
  );


  if (!llmConfig) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(CreateEntitiesFromTemplateErrors.CORE_ERROR);
    } else {
      llmConfig = llms[0];
    }
  }

  llmConfig.max_tokens = agentTemplate.properties?.max_tokens || llmConfig.max_tokens;
  llmConfig.temperature = agentTemplate.properties?.temperature || llmConfig.temperature;
  llmConfig.context_window = agentTemplate.properties?.context_window_limit || llmConfig.context_window;
  llmConfig.max_reasoning_tokens = agentTemplate.properties?.max_reasoning_tokens || llmConfig.max_reasoning_tokens;

  // Create the agent
  const createAgentRequest: CreateAgentRequest = {
    project_id: projectId,
    name:
      overrides.name ||
      uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 3,
        separator: '-',
      }),
    system: agentTemplate.systemPrompt,
    llm_config: llmConfig,
    tool_ids: agentTemplate.toolIds || [],
    tool_rules: agentTemplate.toolRules || [],
    source_ids: agentTemplate.sourceIds || [],
    memory_blocks: memoryBlocks,
    tags: overrides.tags || agentTemplate.tags,
    identity_ids: overrides.identityIds || agentTemplate.identityIds,
    initial_message_sequence: overrides.initialMessageSequence,
    tool_exec_environment_variables: finalToolVariables,
    hidden: overrides.hidden || false,
    include_base_tools: false,
    include_base_tool_rules: false,
    include_multi_agent_tools: false,
    include_default_source: false,
    embedding: DEFAULT_EMBEDDING_MODEL,
    max_files_open: agentTemplate.properties?.max_files_open,
    reasoning: agentTemplate.properties?.enable_reasoner || agentTemplate.properties?.put_inner_thoughts_in_kwargs,
    per_file_view_window_char_limit:
      agentTemplate.properties?.per_file_view_window_char_limit,
    template_id: template.id,
    base_template_id: baseTemplate.id,
  };

  const newAgent = await AgentsService.createAgent(
    {
      requestBody: createAgentRequest,
    },
    {
      user_id: lettaAgentsId,
    },
  ).catch((error) => {
    if (isAPIError(error)) {
      Sentry.captureException(error, {
        extra: {
          template: template.name,
          body: error.body,
        }
      })
    } else {
      Sentry.captureException(error, {
        extra: {
          template: template.name,
        }
      })
    }


    return null
  });

  if (!newAgent?.id) {
    throw new Error('Failed to create agent from template');
  }

  return [newAgent];
}
