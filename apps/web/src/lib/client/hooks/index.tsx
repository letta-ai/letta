'use client';
import { webApi, webApiQueryKeys } from '$web/client';

export function useCurrentUser() {
  const { data } = webApi.user.getCurrentUser.useQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
  });

  return data?.body;
}

export function useCurrentOrganization() {
  const { data: organization } =
    webApi.organizations.getCurrentOrganization.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
    });

  return organization?.body;
}
