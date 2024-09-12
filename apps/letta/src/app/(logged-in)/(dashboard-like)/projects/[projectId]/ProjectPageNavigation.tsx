'use client';
import { Avatar, Button, HStack, VStack } from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProject } from './hooks';
import { usePathname } from 'next/navigation';

export function ProjectPageNavigation() {
  const { id: projectId, name } = useCurrentProject();
  const pathname = usePathname();

  const afterIdElements = useMemo(() => {
    return `/${pathname.split('/').slice(3).join('/')}`;
  }, [pathname]);

  return (
    <VStack paddingX="large" gap="large" paddingY>
      <HStack align="center">
        <Avatar name={name} />
        {name}
      </HStack>
      <VStack className="min-w-[250px]">
        <Button
          active={afterIdElements === '/'}
          color="tertiary-transparent"
          label="Project Home"
          href={`/projects/${projectId}`}
        />
        <Button
          active={afterIdElements.startsWith('/staging')}
          color="tertiary-transparent"
          label="Staging"
          href={`/projects/${projectId}/staging`}
        />
        <Button
          active={afterIdElements.startsWith('/deployments')}
          color="tertiary-transparent"
          label="Deployments"
          href={`/projects/${projectId}/deployments`}
        />
      </VStack>
    </VStack>
  );
}
