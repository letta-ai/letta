'use client';
import { useTranslations } from 'next-intl';
import {
  DashboardWithSidebarWrapper,
  SidebarTitle,
} from '@letta-web/component-library';
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
