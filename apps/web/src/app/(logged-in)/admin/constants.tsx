import type { AdminNavigationItemProps } from './types';
import {
  LayoutIcon,
  CompanyIcon,
  InferenceModelsIcon,
  EmbeddingModelsIcon,
  UserFaceIcon,
  ToolsIcon,
  TrophyIcon,
} from '@letta-cloud/ui-component-library';
import React from 'react';

export const NavigationItems: AdminNavigationItemProps[] = [
  {
    id: 'view-organizations',
    label: 'View Organizations',
    icon: <CompanyIcon />,
    href: '/admin/organizations',
    description: 'View and Manage Organizations',
  },
  {
    id: 'view-users',
    label: 'View Users',
    icon: <UserFaceIcon />,
    href: '/admin/users',
    description: 'View and Manage Users',
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
  {
    id: 'content-violations',
    label: 'Content Violations',
    icon: <ToolsIcon />,
    href: '/admin/content-violations',
    description: 'CONTENT WARNING: Sussy content ahead',
  },
  {
    id: 'leaderboard',
    label: 'Usage Leaderboard',
    icon: <TrophyIcon />,
    href: '/admin/leaderboard',
    description: 'Organization usage leaderboard',
  },
];
