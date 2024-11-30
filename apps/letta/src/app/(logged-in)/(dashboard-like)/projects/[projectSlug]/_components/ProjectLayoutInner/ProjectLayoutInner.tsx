'use client';

import {
  SidebarTitle,
  DashboardWithSidebarWrapper,
  Robot2Icon,
  ControllerIcon,
  FactoryIcon,
  FolderManagedIcon,
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
      projectTitle={<SidebarTitle name={name} />}
      navigationItems={[
        {
          id: 'home',
          icon: <ControllerIcon />,
          label: t('nav.home'),
          href: `/projects/${projectSlug}`,
        },
        {
          icon: <Robot2Icon />,
          id: 'agents',
          label: t('nav.agents'),
          href: `/projects/${projectSlug}/agents`,
        },
        {
          id: 'templates',
          icon: <FactoryIcon />,
          label: t('nav.templates'),
          href: `/projects/${projectSlug}/templates`,
        },
        {
          id: 'settings',
          icon: <FolderManagedIcon />,
          label: t('nav.settings'),
          href: `/projects/${projectSlug}/settings`,
        },
      ]}
    >
      {props.children}
    </DashboardWithSidebarWrapper>
  );
}
