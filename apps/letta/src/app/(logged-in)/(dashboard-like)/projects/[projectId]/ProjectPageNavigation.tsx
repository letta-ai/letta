'use client';
import { Button, HStack } from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProject } from './hooks';
import { usePathname } from 'next/navigation';

export function ProjectPageNavigation() {
  const { id: projectId } = useCurrentProject();
  const pathname = usePathname();

  const afterIdElements = useMemo(() => {
    return `/${pathname.split('/').slice(3).join('/')}`;
  }, [pathname]);

  return (
    <HStack>
      <Button
        active={afterIdElements === '/'}
        color="tertiary-transparent"
        label="Project Home"
        href={`/projects/${projectId}`}
      />
      <Button
        active={afterIdElements === '/deployments'}
        color="tertiary-transparent"
        label="Deployment"
        href={`/projects/${projectId}/deployments`}
      />
      <Button
        active={afterIdElements === '/analytics'}
        color="tertiary-transparent"
        label="Analytics"
        href={`/projects/${projectId}/analytics`}
      />
    </HStack>
  );
}
