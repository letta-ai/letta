'use client';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { PartialProjectType } from '$letta/web-api/contracts';

export function useCurrentProject(): PartialProjectType {
  const projectSlug = useParams<{ projectSlug: string }>().projectSlug;

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
  });

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
