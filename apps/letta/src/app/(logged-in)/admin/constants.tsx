import type { AdminNavigationItemProps } from './types';
import { ListIcon, LayoutIcon, CompanyIcon } from '@letta-web/component-library';
import React from 'react';

export const NavigationItems: AdminNavigationItemProps[] = [
  {
    id: 'whitelist',
    label: 'Manage Whitelist',
    icon: <ListIcon />,
    href: '/admin/whitelist',
    description: 'Manage the whitelist of users who can access the app',
  },
  {
    id: 'view-organizations',
    label: 'View Organizations',
    icon: <CompanyIcon />,
    href: '/admin/organizations',
    description: 'View and Manage Organizations',
  },
  {
    id: 'flush-layouts',
    label: 'Flush Layouts',
    icon: <LayoutIcon />,
    href: '/admin/flush-layouts',
    description: 'Flush the cache of layouts',
  }
];
