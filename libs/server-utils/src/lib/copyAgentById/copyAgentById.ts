import { AgentsService } from '@letta-cloud/letta-agents-api';
import { omittedFieldsOnCopy } from '../updateAgentFromAgentId/updateAgentFromAgentId';
import * as lodash from 'lodash';
import { attachVariablesToTemplates } from '../../utils/attachVariablesToTemplates/attachVariablesToTemplates';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

interface CopyAgentByIdOptions {
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  tags?: string[];
  templateVersionId?: string;
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
    baseTemplateId,
  } = options;

  const [baseAgent, agentSources] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
    AgentsService.listAgentSources(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
  ]);

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
    agentSources.map(async (source) => {
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
