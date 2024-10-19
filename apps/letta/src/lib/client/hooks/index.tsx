'use client';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentUser() {
  const { data } = webApi.user.getCurrentUser.useQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
  });

  return data?.body;
}
