import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { BreadcrumbProps } from '../../core/Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../../core/Breadcrumb/Breadcrumb';

interface TitleProps {
  title?: BreadcrumbProps['items'] | string;
}

function Title({ title }: TitleProps) {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return (
      <Typography bold variant="heading1">
        {title}
      </Typography>
    );
  }

  return <Breadcrumb items={title} />;
}

interface DashboardPageLayoutProps {
  icon?: React.ReactNode;
  title?: TitleProps['title'];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardPageLayout(props: DashboardPageLayoutProps) {
  const { icon, title, actions } = props;

  return (
    <VStack gap={false} fullWidth fullHeight>
      <HStack
        align="center"
        as="header"
        wrap
        className="min-h-biHeight-lg h-biHeight-lg"
        justify="spaceBetween"
        fullWidth
        paddingX="large"
        paddingTop="large"
      >
        <HStack align="center">
          {icon}
          <Title title={title} />
        </HStack>
        <HStack align="center">{actions}</HStack>
      </HStack>
      <VStack fullWidth collapseHeight>
        {props.children}
      </VStack>
    </VStack>
  );
}
