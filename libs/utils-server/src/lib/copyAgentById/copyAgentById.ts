import { AgentsService } from '@letta-cloud/sdk-core';
import { omittedFieldsOnCopy } from '../updateAgentFromAgentId/updateAgentFromAgentId';
import * as lodash from 'lodash';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { attachVariablesToTemplates } from '../attachVariablesToTemplates/attachVariablesToTemplates';

interface CopyAgentByIdOptions {
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  tags?: string[];
  templateVersionId?: string;
  identityIds?: string[];
  baseTemplateId?: string;
  projectId?: string;
  name?: string;
}

export async function copyAgentById(
  baseAgentId: string,
  lettaAgentsUserId: string,
  options: CopyAgentByIdOptions = {},
) {
  const {
    memoryVariables,
    tags,
    name,
    toolVariables,
    projectId,
    templateVersionId,
    identityIds,
    baseTemplateId,
  } = options;

  const baseAgent = await AgentsService.retrieveAgent(
    {
      agentId: baseAgentId,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  const agentBody = attachVariablesToTemplates(baseAgent, memoryVariables);

  const nextToolVariables = baseAgent.tool_exec_environment_variables?.reduce(
    (acc, tool) => {
      acc[tool.key] = toolVariables?.[tool.key] || '';

      return acc;
    },
    {} as Record<string, string>,
  );

  const nextAgent = await AgentsService.createAgent(
    {
      requestBody: {
        ...lodash.omit(baseAgent, omittedFieldsOnCopy),
        project_id: projectId,
        template_id: templateVersionId,
        identity_ids: identityIds,
        base_template_id: baseTemplateId,
        tool_ids: agentBody.tool_ids,
        name:
          name ||
          uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
            length: 3,
            separator: '-',
          }),
        // merge base tool variables as well as the tool variables passed in
        tool_exec_environment_variables: {
          ...nextToolVariables,
          ...toolVariables,
        },
        tags,
        source_ids: baseAgent.sources
          .map((source) => source.id || '')
          .filter(Boolean),
        memory_blocks: agentBody.memory_blocks.map((block) => {
          return {
            limit: block.limit,
            label: block.label || '',
            value: block.value,
          };
        }),
      },
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  if (!nextAgent?.id) {
    throw new Error('Failed to clone agent');
  }

  await Promise.all(
    baseAgent.sources.map(async (source) => {
      if (!source.id || !baseAgent.id) {
        return;
      }

      await AgentsService.attachSourceToAgent(
        {
          agentId: nextAgent.id || '',
          sourceId: source.id,
        },
        {
          user_id: lettaAgentsUserId,
        },
      );
    }),
  );

  return nextAgent;
}
