import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useParams } from 'next/navigation';

export function useCurrentTemplate() {
  const {  templateName, projectSlug, } = useParams<{
    templateName: string;
    projectSlug: string;
  }>();

  const templateQuery =  cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesWithSearch({
      project_slug: projectSlug,
      name: templateName || '',
    }),
    queryData: {},
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: !!templateName && !!projectSlug,
  });

  return templateQuery.data?.body.templates[0] || null;
}
