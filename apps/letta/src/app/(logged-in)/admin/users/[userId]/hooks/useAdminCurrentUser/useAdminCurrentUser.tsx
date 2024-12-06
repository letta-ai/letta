import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useAdminCurrentUser() {
  const { userId } = useParams<{ userId: string }>();

  const { data } = webApi.admin.users.adminGetUser.useQuery({
    queryKey: webApiQueryKeys.admin.users.adminGetUser(userId),
    queryData: {
      params: {
        userId,
      },
    },
  });

  if (!data) {
    return null;
  }

  return data.body;
}
