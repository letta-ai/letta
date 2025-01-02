'use client';
import { webApi, webApiQueryKeys } from '$web/client';
import type { webApiContracts } from '$web/client';
import type { ServerInferResponseBody } from '@ts-rest/core';

export function useCurrentUser():
  | ServerInferResponseBody<typeof webApiContracts.user.getCurrentUser, 200>
  | undefined {
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
