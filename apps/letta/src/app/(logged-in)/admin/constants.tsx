import type { AdminNavigationItemProps } from './types';
import { ListIcon, LayoutIcon } from '@letta-web/component-library';
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
    id: 'flush-layouts',
    label: 'Flush Layouts',
    icon: <LayoutIcon />,
    href: '/admin/flush-layouts',
    description: 'Flush the cache of layouts',
  },
];
