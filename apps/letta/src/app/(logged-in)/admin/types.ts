import type React from 'react';

export interface AdminNavigationItemProps {
  href: string;
  preload?: boolean;
  description?: string;
  label: string;
  id: string;
  active?: boolean;
  hideLabel?: boolean;
  icon?: React.ReactNode;
}
