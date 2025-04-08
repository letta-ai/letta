'use client';
import { useParams, usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$web/client';
import type { PartialProjectType } from '$web/web-api/contracts';
import { useTranslations } from '@letta-cloud/translations';

export function useCurrentProject(): PartialProjectType {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const pathname = usePathname();
  const t = useTranslations('projects/hooks');

  const { data } = webApi.projects.getProjectByIdOrSlug.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(projectSlug),
    queryData: {
      params: {
        projectId: projectSlug,
      },
      query: {
        lookupBy: 'slug',
      },
    },
    refetchOnMount: false,
    enabled: !!projectSlug,
  });

  if (pathname.startsWith('/development-servers')) {
    return {
      updatedAt: '',
      id: '',
      name: t('remoteDevelopment'),
      slug: '/development-servers/local',
    };
  }

  if (!data) {
    return {
      updatedAt: '',
      id: '',
      name: '',
      slug: '',
    };
  }

  return data.body;
}
