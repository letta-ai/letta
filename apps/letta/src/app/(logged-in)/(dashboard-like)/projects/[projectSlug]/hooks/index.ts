'use client';
import { useParams, usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { PartialProjectType } from '$letta/web-api/contracts';
import { useTranslations } from 'next-intl';

export const REMOTE_DEVELOPMENT_ID = 'remote-development';

export function useCurrentProject(): PartialProjectType {
  const projectSlug = useParams<{ projectSlug: string }>().projectSlug;
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
    enabled: !!projectSlug,
  });

  if (pathname.startsWith('/development-servers')) {
    return {
      updatedAt: '',
      id: REMOTE_DEVELOPMENT_ID,
      name: t('remoteDevelopment'),
      slug: '/development-servers/dashboard',
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
