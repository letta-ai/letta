'use client';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  DashboardWithSidebarWrapper,
  HStack,
  Tooltip,
  Typography,
} from '@letta-web/component-library';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useCurrentProject } from '../../hooks';

type ProjectLayoutInnerProps = PropsWithChildren;

function ProjectAvatar() {
  const { name } = useCurrentProject();

  return (
    <HStack fullWidth align="center" justify="start">
      <Avatar size="medium" name={name} />
      <Tooltip asChild content={name}>
        <HStack collapseWidth overflow="hidden">
          <Typography fullWidth overflow="ellipsis" noWrap align="left">
            {name}
          </Typography>
        </HStack>
      </Tooltip>
    </HStack>
  );
}

export function ProjectLayoutInner(props: ProjectLayoutInnerProps) {
  const t = useTranslations('projects/(projectSlug)/layout');
  const { slug: projectSlug } = useCurrentProject();

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/projects"
      projectTitle={<ProjectAvatar />}
      navigationItems={[
        {
          id: 'home',
          label: t('nav.home'),
          href: `/projects/${projectSlug}`,
        },
        {
          id: 'templates',
          label: t('nav.templates'),
          href: `/projects/${projectSlug}/templates`,
        },
        {
          id: 'agents',
          label: t('nav.agents'),
          href: `/projects/${projectSlug}/agents`,
        },
        {
          id: 'settings',
          label: t('nav.settings'),
          href: `/projects/${projectSlug}/settings`,
        },
      ]}
    >
      {props.children}
    </DashboardWithSidebarWrapper>
  );
}
