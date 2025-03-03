import type { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCurrentUser } from '$web/client/hooks';
import { useMemo } from 'react';

export function useUserHasPermission(permission: ApplicationServices) {
  const user = useCurrentUser();

  const userPermissionsSet = useMemo(() => {
    return new Set(user?.permissions ?? []);
  }, [user?.permissions]);

  return [userPermissionsSet.has(permission)];
}
