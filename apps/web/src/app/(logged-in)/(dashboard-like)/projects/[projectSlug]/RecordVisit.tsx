'use client';

import { useEffect } from 'react';
import { recordProjectVisit } from './actions';

export function RecordVisit({ organizationId, projectSlug }: { organizationId: string; projectSlug: string }) {
  useEffect(() => {
    recordProjectVisit(organizationId, projectSlug);
  }, [organizationId, projectSlug]);

  return null;
}
