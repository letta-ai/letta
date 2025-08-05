import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import type { BreadcrumbItemType } from '../../core/Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../../core/Breadcrumb/Breadcrumb';

interface CondensedDashboardPageProps {
  children?: React.ReactNode;
  title: BreadcrumbItemType[];
  actions?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export function CondensedDashboardPage(props: CondensedDashboardPageProps) {
  const { children, actions, title, subtitle } = props;

  return (
    <VStack
      overflow="hidden"
      gap={false}
      collapseHeight
      className="pt-[5px] encapsulated-full-height-max pr-2 encapsulated-full-height"
    >
      <VStack
        borderBottom
        className="min-h-[50px]"
        align="center"
        padding="small"
        fullWidth
      >
        <HStack fullWidth justify="spaceBetween">
          <HStack align="center">
            <Breadcrumb size="small" items={title} />
          </HStack>
          {actions}
        </HStack>
        {subtitle}
      </VStack>

      <VStack collapseHeight flex>
        {children}
      </VStack>
    </VStack>
  );
}
