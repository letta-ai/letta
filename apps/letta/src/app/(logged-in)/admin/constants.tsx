import type { AdminNavigationItemProps } from './types';
import {
  ListIcon,
  LayoutIcon,
  CompanyIcon,
  InferenceModelsIcon,
  EmbeddingModelsIcon,
} from '@letta-web/component-library';
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
  },
  {
    id: 'inference-models',
    label: 'Inference Models',
    icon: <InferenceModelsIcon />,
    href: '/admin/models/inference',
    description: 'Manage inference models',
  },
  {
    id: 'embedding-models',
    label: 'Embedding Models',
    icon: <EmbeddingModelsIcon />,
    href: '/admin/models/embedding',
    description: 'Manage embedding models',
  },
];
