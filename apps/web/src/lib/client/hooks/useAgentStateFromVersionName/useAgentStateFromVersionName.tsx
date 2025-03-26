import type { AgentState } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export type AgentStateVersions = string | 'current' | 'latest';

export function useAgentStateFromVersionName(
  versionName: AgentStateVersions,
  defaultState?: AgentState,
): AgentState | null | undefined {
  const currentAgent = useCurrentAgent();

  if (versionName === 'current') {
    return currentAgent as AgentState;
  }

  const { data: agent } =
    webApi.agentTemplates.getAgentTemplateByVersion.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
        `${currentAgent.name}:${versionName}`,
      ),
      queryData: {
        params: { slug: `${currentAgent.name}:${versionName}` },
      },
      retry: false,
    });

  return agent?.body.state || defaultState;
}
