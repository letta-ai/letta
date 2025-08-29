import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useParams } from 'next/navigation';
import { useCurrentTemplate } from '../useCurrentTemplate/useCurrentTemplate';

export function useCurrentAgentTemplateQueryKey() {
  const { template: currentTemplate } = useCurrentTemplate();
  const { entityId } = useParams<{
    entityId?: string;
  }>();

  return webApiQueryKeys.templates.getAgentTemplateByEntityId(
    currentTemplate?.id || '',
    entityId || 'default',
  );
}

export function useCurrentAgentTemplate() {
  const { template: currentTemplate } = useCurrentTemplate();
  const { entityId } = useParams<{
    entityId?: string;
  }>();

  const queryKey = useCurrentAgentTemplateQueryKey();

  return webApi.templates.getAgentTemplateByEntityId.useQuery({
    queryKey,
    queryData: {
      params: {
        templateId: currentTemplate?.id || '',
        entityId: entityId || 'default',
      },
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: !!currentTemplate?.id || !!entityId,
  });
}
