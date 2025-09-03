import type { TxType } from '@letta-cloud/service-database';
import {
  agentTemplateV2,
  db
} from '@letta-cloud/service-database';
import type { letta__schemas__agent_file__AgentSchema } from '@letta-cloud/sdk-core';
import { nanoid } from 'nanoid';
import { DEFAULT_LLM_MODEL } from '@letta-cloud/types';
import { convertRecordMemoryVariablesToMemoryVariablesV1 } from '@letta-cloud/utils-shared';

interface CreateTemplateFromAgentFileAgentSchemaProps {
  agentSchema?: letta__schemas__agent_file__AgentSchema;
  entityId?: string;
  organizationId: string;
  lettaTemplateId: string;
  projectId: string;
  override_agentTemplateId?: string;
  tx?: TxType;
}

export async function createTemplateEntitiesFromAgentFileAgentSchema(
  props: CreateTemplateFromAgentFileAgentSchemaProps,
) {
  const {
    agentSchema,
    entityId,
    tx,
    override_agentTemplateId,
    projectId,
    organizationId,
    lettaTemplateId,
  } = props;

  async function executeWithTransaction(transaction: TxType) {
    // Convert tool environment variables to the format expected by the template
    const toolVariables = agentSchema?.tool_exec_environment_variables
      ? convertRecordMemoryVariablesToMemoryVariablesV1(agentSchema.tool_exec_environment_variables)
      : null;

    // Create agent template from AgentSchema
    const agentTemplate = {
      toolIds: agentSchema?.tool_ids ?? [],
      sourceIds: agentSchema?.source_ids ?? [],
      tags: agentSchema?.tags ?? [],
      identityIds: [],
      agentType: agentSchema?.agent_type ?? 'memgpt_v2_agent',
      model: agentSchema?.llm_config?.handle ?? DEFAULT_LLM_MODEL,
      toolRules: agentSchema?.tool_rules ?? [],
      systemPrompt: agentSchema?.system ?? '',
      toolVariables,
      memoryVariables: null,
      properties: {
        temperature: agentSchema?.llm_config?.temperature ?? 0.7,
        enable_reasoner: agentSchema?.llm_config?.enable_reasoner ?? false,
        put_inner_thoughts_in_kwargs: agentSchema?.llm_config?.put_inner_thoughts_in_kwargs ?? false,
        context_window_limit: agentSchema?.llm_config?.context_window ?? null,
        max_tokens: agentSchema?.llm_config?.max_tokens ?? null,
        max_reasoning_tokens: agentSchema?.llm_config?.max_reasoning_tokens ?? null,
        max_files_open: null,
        per_file_view_window_char_limit: null,
        message_buffer_autoclear: null,
      },
    };

    // Create the agent template
    const [res] = await transaction
      .insert(agentTemplateV2)
      .values({
        ...agentTemplate,
        entityId: entityId || nanoid(8),
        lettaTemplateId,
        ...(override_agentTemplateId ? { id: override_agentTemplateId } : {}),
        organizationId,
        projectId,
      })
      .returning();

    return res;
  }

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeWithTransaction(tx);
  } else {
    return db.transaction(executeWithTransaction);
  }
}
