'use client'
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
      version: 'current',
      exact: true,
    }),
    queryData: {
      query: {
        project_slug: projectSlug,
        version: 'current',
        name: templateName || '',
        exact: 'true',
      }
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: !!templateName && !!projectSlug,
  });

  // is matching
  if (templateQuery.data?.body.templates[0]?.name === templateName) {
    return {
      template: templateQuery.data?.body.templates[0],
      isLoading: templateQuery.isLoading,
    };
  }

  return {
    template: undefined,
    isLoading: templateQuery.isLoading,
  };
}
