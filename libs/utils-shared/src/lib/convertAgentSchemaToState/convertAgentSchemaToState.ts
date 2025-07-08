import type {
  AgentSchema,
  AgentState,
  Memory,
  ChildToolRule,
  InitToolRule,
  TerminalToolRule,
  ConditionalToolRule,
  ContinueToolRule,
  RequiredBeforeExitToolRule,
  MaxCountPerStepToolRule,
  ParentToolRule,
  Tool,
} from '@letta-cloud/sdk-core';

interface ConvertAgentSchemaToStateOptions {
  tools: Tool[];
}

export function convertAgentSchemaToState(
  schema: AgentSchema,
  options: ConvertAgentSchemaToStateOptions = {
    tools: [],
  },
): AgentState {
  const { tools: existingTools = [] } = options;

  const existingToolMap = new Map(
    existingTools.map((tool) => [tool.name, tool]),
  );

  // Convert core_memory blocks to Memory structure
  const memory: Memory = {
    blocks: schema.core_memory.map((coreBlock) => ({
      id: '', // Core memory blocks don't have IDs in schema
      created_at: coreBlock.created_at,
      updated_at: coreBlock.updated_at,
      created_by_id: null,
      last_updated_by_id: null,
      label: coreBlock.label,
      name: coreBlock.label, // Use label as name since name doesn't exist
      value: coreBlock.value,
      limit: coreBlock.limit,
      template: coreBlock.is_template,
      persona: false, // Not available in CoreMemoryBlockSchema
      human: false, // Not available in CoreMemoryBlockSchema
      user_id: null,
      organization_id: null,
      metadata: coreBlock.metadata_,
      template_name: coreBlock.template_name,
      is_template: coreBlock.is_template,
      agent_id: null,
      description: coreBlock.description,
      source_id: null,
      source_name: null,
      source_creation_date: null,
      source_last_updated_date: null,
      source_type: null,
      source_size: null,
      source_num_passages: null,
      source_num_documents: null,
      source_metadata: null,
      source_embedding_config: null,
      block_type: 'core_memory',
    })),
    file_blocks: [],
    prompt_template: undefined,
  };

  // Convert tool rules from schema format to state format
  const toolRules =
    schema.tool_rules?.map((rule) => {
      // The rule types are compatible, just pass through
      return rule;
    }) || null;

  // Convert messages to message IDs (MessageSchema doesn't have id, using index)
  const messageIds =
    schema.messages?.map((_, index) => index.toString()) || null;

  // Convert tools from ToolSchema to Tool format
  const tools = schema.tools.map((toolSchema) => ({
    id: existingToolMap.has(toolSchema.name)
      ? existingToolMap.get(toolSchema.name).id
      : '',
    created_at: toolSchema.created_at,
    updated_at: toolSchema.updated_at,
    created_by_id: null,
    last_updated_by_id: null,
    name: toolSchema.name,
    description: toolSchema.description,
    tags: toolSchema.tags,
    source_type: toolSchema.source_type,
    source_code: toolSchema.source_code,
    json_schema: toolSchema.json_schema,
    user_id: null,
    organization_id: null,
    module: null, // Not available in ToolSchema
    file_name: null, // Not available in ToolSchema
    function_name: null, // Not available in ToolSchema
    tool_type: toolSchema.tool_type as
      | 'custom'
      | 'external_composio'
      | 'external_langchain'
      | 'external_mcp'
      | 'letta_builtin'
      | 'letta_core'
      | 'letta_files_core'
      | 'letta_memory_core'
      | 'letta_multi_agent_core'
      | 'letta_sleeptime_core'
      | 'letta_voice_sleeptime_core',
    return_char_limit: toolSchema.return_char_limit,
    heartbeat: false, // Not available in ToolSchema
    enabled: true,
    metadata: toolSchema.metadata_,
    tool_annotations: null,
    tool_run_from_source: null,
    tool_exec_environment_variables: null,
  }));
  // Convert environment variables
  const toolExecEnvVars =
    schema.tool_exec_environment_variables?.map((envVar) => ({
      id: '',
      created_at: schema.created_at,
      updated_at: schema.updated_at,
      created_by_id: null,
      last_updated_by_id: null,
      key: envVar.key,
      value: envVar.value,
      description: envVar.description || null,
      agent_id: '',
      user_id: null,
      organization_id: null,
    })) || undefined;

  return {
    id: '', // AgentSchema doesn't have an ID field
    name: schema.name,
    system: schema.system,
    agent_type: schema.agent_type as
      | 'memgpt_agent'
      | 'memgpt_v2_agent'
      | 'react_agent'
      | 'sleeptime_agent'
      | 'split_thread_agent'
      | 'voice_convo_agent'
      | 'voice_sleeptime_agent'
      | 'workflow_agent',
    llm_config: schema.llm_config,
    embedding_config: schema.embedding_config,
    memory: memory,
    tools: tools,
    sources: [], // AgentSchema doesn't have sources
    tags: schema.tags?.map((tag) => tag.tag) || [],
    tool_rules: toolRules as Array<
      | ChildToolRule
      | ConditionalToolRule
      | ContinueToolRule
      | InitToolRule
      | MaxCountPerStepToolRule
      | ParentToolRule
      | RequiredBeforeExitToolRule
      | TerminalToolRule
    > | null,
    message_ids: messageIds,
    created_at: schema.created_at,
    updated_at: schema.updated_at,
    created_by_id: null,
    last_updated_by_id: null,
    organization_id: null,
    description: schema.description,
    metadata: schema.metadata_,
    tool_exec_environment_variables: toolExecEnvVars,
    project_id: null,
    template_id: null,
    base_template_id: null,
    identity_ids: [],
    message_buffer_autoclear: schema.message_buffer_autoclear,
    enable_sleeptime: null,
    multi_agent_group: null, // Convert unknown to null for now
    last_run_completion: null,
    last_run_duration_ms: null,
    timezone: null,
    response_format: null,
  };
}
