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
  MonitoringIcon,
  ListIcon,
  TwoMemoryBlocksIcon,
  DataObjectIcon,
  AbtestIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

type ProjectLayoutInnerProps = PropsWithChildren;

export function ProjectLayoutInner(props: ProjectLayoutInnerProps) {
  const t = useTranslations('projects/(projectSlug)/layout');
  const { slug: projectSlug, name } = useCurrentProject();
  const [canCRDProjects] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  );

  const { data: isMemoryBlocksEnabled } = useFeatureFlag('MEMORY_BLOCK_VIEWER');
  const { data: isDatasetsEnabled } = useFeatureFlag('DATASETS');

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
        ...(isMemoryBlocksEnabled
          ? [
              {
                id: 'blocks',
                icon: <TwoMemoryBlocksIcon />,
                label: t('nav.blocks'),
                href: `/projects/${projectSlug}/blocks`,
              },
            ]
          : []),
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
        {
          title: t('nav.observability'),
          items: [
            {
              icon: <MonitoringIcon />,
              id: 'observability',
              label: t('nav.monitoring'),
              href: `/projects/${projectSlug}/observability`,
            },
            {
              icon: <ListIcon />,
              id: 'steps',
              label: t('nav.responses'),
              href: `/projects/${projectSlug}/responses`,
            },
          ],
        },
        ...(isDatasetsEnabled
          ? [
              {
                title: t('nav.evals'),
                items: [
                  {
                    icon: <AbtestIcon />,
                    id: 'ab-test',
                    label: t('nav.ab'),
                    href: `/projects/${projectSlug}/ab-tests`,
                  },
                  {
                    icon: <DataObjectIcon />,
                    id: 'datasets',
                    label: t('nav.datasets'),
                    href: `/projects/${projectSlug}/datasets`,
                  },
                ],
              },
            ]
          : []),
      ]}
    >
      {props.children}
    </DashboardWithSidebarWrapper>
  );
}
