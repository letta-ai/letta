'use client'
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useParams } from 'next/navigation';

export function useCurrentTemplateSnapshot(version: string) {
  const {  templateName, projectSlug } = useParams<{
    templateName: string;
    projectSlug: string;
  }>();


  return cloudAPI.templates.getTemplateSnapshot.useQuery({
    queryKey: cloudQueryKeys.templates.getTemplateSnapshot(
      projectSlug,
      `${templateName}:${version}`,
    ),
    queryData: {
      params: { project: projectSlug, template_version: `${templateName}:${version}` },
    },
    enabled: !!templateName && !!projectSlug,
    retry: false,
  });
}
