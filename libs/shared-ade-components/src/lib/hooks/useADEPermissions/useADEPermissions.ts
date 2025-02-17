import { useADEAppContext } from '../../AppContext/AppContext';
import { useMemo } from 'react';
import type { ApplicationServices } from '@letta-cloud/rbac';

export function useADEPermissions(permission: ApplicationServices) {
  const { user } = useADEAppContext();

  const userPermissionsSet = useMemo(() => {
    return new Set(user?.permissions ?? []);
  }, [user?.permissions]);

  if (!user) {
    return [true];
  }

  return [userPermissionsSet.has(permission)];
}
