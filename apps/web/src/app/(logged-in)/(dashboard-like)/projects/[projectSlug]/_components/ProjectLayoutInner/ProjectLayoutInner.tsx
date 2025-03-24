'use client';

import {
  DashboardWithSidebarWrapper,
  LettaInvaderOutlineIcon,
  SpaceDashboardIcon,
  TemplateIcon,
  InstantMixIcon,
  SidebarTitle,
  HStack,
  IdentitiesIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';

type ProjectLayoutInnerProps = PropsWithChildren;

export function ProjectLayoutInner(props: ProjectLayoutInnerProps) {
  const t = useTranslations('projects/(projectSlug)/layout');
  const { slug: projectSlug, name } = useCurrentProject();
  const [canCRDProjects] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  );

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
          icon: <TemplateIcon />,
          label: t('nav.templates'),
          href: `/projects/${projectSlug}/templates`,
        },
        {
          id: 'identities',
          icon: <IdentitiesIcon />,
          label: t('nav.identities'),
          href: `/projects/${projectSlug}/identities`,
        },
        ...(canCRDProjects
          ? [
              {
                id: 'settings',
                icon: <InstantMixIcon />,
                label: t('nav.settings'),
                href: `/projects/${projectSlug}/settings`,
              },
            ]
          : []),
      ]}
    >
      {props.children}
    </DashboardWithSidebarWrapper>
  );
}
