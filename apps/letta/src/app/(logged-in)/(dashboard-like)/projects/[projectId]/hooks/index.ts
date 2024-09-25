import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { PartialProjectType } from '$letta/web-api/contracts';

export function useCurrentProjectId() {
  return useParams<{ projectId: string }>().projectId;
}

export function useCurrentProject(): PartialProjectType {
  const projectId = useCurrentProjectId();

  const { data } = webApi.projects.getProjectById.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectById(projectId),
    queryData: {
      params: {
        projectId,
      },
    },
  });

  if (!data) {
    return {
      id: '',
      name: '',
    };
  }

  return data.body;
}
