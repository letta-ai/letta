'use client';

import {
  Avatar,
  DashboardWithSidebarWrapper,
  HStack,
  Typography,
} from '@letta-web/component-library';
import React from 'react';
import { useTranslations } from 'next-intl';

interface LocalProjectLayoutProps {
  children: React.ReactNode;
}

function LocalProjectLayout(props: LocalProjectLayoutProps) {
  const t = useTranslations('local-project/layout');
  const { children } = props;

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/local-project"
      returnOverride="/projects"
      projectTitle={
        <HStack align="center">
          <Avatar name={t('title')} />
          <Typography bold>{t('title')}</Typography>
        </HStack>
      }
      navigationItems={[
        {
          label: t('nav.agents'),
          href: `/local-project/agents`,
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default LocalProjectLayout;
