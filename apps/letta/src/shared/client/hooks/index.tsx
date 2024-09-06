import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentUser() {
  const { data } = webApi.user.getCurrentUser.useQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
  });

  if (!data) {
    throw new Error('This hook should only be used when a user is logged in');
  }

  return data.body;
}
