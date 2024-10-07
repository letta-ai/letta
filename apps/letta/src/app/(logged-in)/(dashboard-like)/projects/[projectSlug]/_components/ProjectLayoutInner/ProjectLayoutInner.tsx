'use client';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  DashboardWithSidebarWrapper,
} from '@letta-web/component-library';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useCurrentProject } from '../../hooks';

type ProjectLayoutInnerProps = PropsWithChildren;

function ProjectAvatar() {
  const { name } = useCurrentProject();

  return (
    <>
      <Avatar size="medium" name={name} />
      {name}
    </>
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
