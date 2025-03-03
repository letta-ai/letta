import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { get } from 'lodash-es';

export function useLatestAgentTemplate() {
  const { name } = useCurrentAgent();

  const {
    data: deployedAgentTemplate,
    error,
    isError,
  } = webApi.agentTemplates.getAgentTemplateByVersion.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
      `${name}:latest`,
    ),
    queryData: {
      params: { slug: `${name}:latest` },
    },
    retry: false,
  });

  return {
    deployedAgentTemplate: deployedAgentTemplate?.body,
    notFoundError: isError && get(error, 'status') === 404,
    otherError: isError && get(error, 'status') !== 404,
  };
}
