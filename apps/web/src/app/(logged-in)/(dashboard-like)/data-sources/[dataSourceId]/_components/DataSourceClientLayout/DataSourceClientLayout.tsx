'use client';
import {
  DashboardWithSidebarWrapper,
  SidebarTitle,
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentDataSource } from '../../hooks';

interface DataSourceClientLayoutProps {
  children: React.ReactNode;
}

export function DataSourceClientLayout(props: DataSourceClientLayoutProps) {
  const { children } = props;
  const t = useTranslations('data-sources/layout');
  const source = useCurrentDataSource();

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/data-sources"
      projectTitle={<SidebarTitle name={source?.name || ''} />}
      navigationItems={[
        {
          id: 'files',
          label: t('navigation.files'),
          href: `/data-sources/${source?.id || ''}`,
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}
