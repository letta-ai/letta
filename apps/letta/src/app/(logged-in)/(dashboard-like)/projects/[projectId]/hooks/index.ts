import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentProjectId() {
  return useParams<{ projectId: string }>().projectId;
}

export function useCurrentProject() {
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
    throw new Error('Redirecting to projects');
  }

  return data.body;
}
