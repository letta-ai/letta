import { ActionCard, Typography } from '@letta-web/component-library';
import * as React from 'react';

interface DashboardCardProps {
  largeImage?: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  isSkeleton?: boolean;
  onClick?: () => void;
  testId?: string;
  href?: string;
}

export function DashboardCard(props: DashboardCardProps) {
  const {
    largeImage,
    testId,
    title,
    isSkeleton,
    description,
    badge,
    onClick,
    href,
  } = props;
  return (
    <ActionCard
      title={title}
      largeImage={largeImage}
      isSkeleton={isSkeleton}
      href={href}
      hideClickArrow
      testId={testId}
      badge={badge}
      onClick={onClick}
    >
      <Typography variant="body2" color="lighter" align="left">
        {description}
      </Typography>
    </ActionCard>
  );
}
