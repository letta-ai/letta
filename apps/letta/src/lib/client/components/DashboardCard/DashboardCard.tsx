import { ActionCard, Typography } from '@letta-web/component-library';
import * as React from 'react';

interface DashboardCardProps {
  largeImage?: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  isSkeleton?: boolean;
  onClick?: () => void;
  href?: string;
}

export function DashboardCard(props: DashboardCardProps) {
  const { largeImage, title, isSkeleton, description, badge, onClick, href } =
    props;
  return (
    <ActionCard
      title={title}
      largeImage={largeImage}
      isSkeleton={isSkeleton}
      href={href}
      hideClickArrow
      badge={badge}
      onClick={onClick}
    >
      <Typography variant="body2" color="lighter" align="left">
        {description}
      </Typography>
    </ActionCard>
  );
}
