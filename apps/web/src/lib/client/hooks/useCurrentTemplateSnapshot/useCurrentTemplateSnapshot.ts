'use client'
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useParams } from 'next/navigation';

export function useCurrentTemplateSnapshot(version: string) {
  const {  templateName, } = useParams<{
    templateName: string;
  }>();

  const { slug } = useCurrentProject();

  return cloudAPI.templates.getTemplateSnapshot.useQuery({
    queryKey: cloudQueryKeys.templates.getTemplateSnapshot(
      slug,
      `${templateName}:${version}`,
    ),
    queryData: {
      params: { project: slug, template_version: `${templateName}:${version}` },
    },
    retry: false,
  });
}
