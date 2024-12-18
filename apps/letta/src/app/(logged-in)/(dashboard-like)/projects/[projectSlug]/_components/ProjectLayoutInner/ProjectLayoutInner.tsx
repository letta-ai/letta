'use client';

import {
  DashboardWithSidebarWrapper,
  LettaInvaderOutlineIcon,
  SpaceDashboardIcon,
  TabGroupIcon,
  InstantMixIcon,
  SidebarTitle,
  HStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useCurrentProject } from '../../hooks';

type ProjectLayoutInnerProps = PropsWithChildren;

export function ProjectLayoutInner(props: ProjectLayoutInnerProps) {
  const t = useTranslations('projects/(projectSlug)/layout');
  const { slug: projectSlug, name } = useCurrentProject();

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/projects"
      returnText={t('nav.return')}
      projectTitle={
        <HStack
          fullWidth
          overflow="hidden"
          paddingBottom="small"
          paddingTop="small"
        >
          <SidebarTitle avatarSize="small" variant="inline" name={name} />
        </HStack>
      }
      navigationItems={[
        {
          id: 'home',
          icon: <SpaceDashboardIcon />,
          label: t('nav.home'),
          href: `/projects/${projectSlug}`,
        },
        {
          icon: <LettaInvaderOutlineIcon />,
          id: 'agents',
          label: t('nav.agents'),
          href: `/projects/${projectSlug}/agents`,
        },
        {
          id: 'templates',
          icon: <TabGroupIcon />,
          label: t('nav.templates'),
          href: `/projects/${projectSlug}/templates`,
        },
        {
          id: 'settings',
          icon: <InstantMixIcon />,
          label: t('nav.settings'),
          href: `/projects/${projectSlug}/settings`,
        },
      ]}
    >
      {props.children}
    </DashboardWithSidebarWrapper>
  );
}
