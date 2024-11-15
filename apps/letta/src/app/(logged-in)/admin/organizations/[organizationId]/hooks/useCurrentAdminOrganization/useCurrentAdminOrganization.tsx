import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentAdminOrganization() {
  const { organizationId } = useParams<{ organizationId: string }>();

  const { data } = webApi.admin.organizations.getOrganization.useQuery({
    queryKey:
      webApiQueryKeys.admin.organizations.getOrganization(organizationId),
    queryData: {
      params: {
        organizationId,
      },
    },
  });

  if (!data) {
    return null;
  }

  return data.body;
}
