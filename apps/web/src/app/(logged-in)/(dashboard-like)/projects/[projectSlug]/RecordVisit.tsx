'use client';
import { useEffect } from 'react';
import { recordProjectVisit } from './actions';
import { useCurrentUser } from '$web/client/hooks';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

export function RecordVisit() {
  const user = useCurrentUser();
  const { slug } = useCurrentProject();


  useEffect(() => {
    if (!user?.activeOrganizationId) {
      return;
    }

    void recordProjectVisit(user.activeOrganizationId, slug);
  }, [user?.activeOrganizationId, slug]);

  return null;
}
