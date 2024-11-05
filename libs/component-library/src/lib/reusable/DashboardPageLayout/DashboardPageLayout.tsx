'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { BreadcrumbProps } from '../../core/Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../../core/Breadcrumb/Breadcrumb';
import './DashboardPageLayout.scss';
import { cn } from '@letta-web/core-style-config';
interface TitleProps {
  title?: BreadcrumbProps['items'] | string;
}

function Title({ title }: TitleProps) {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return <Typography variant="heading1">{title}</Typography>;
  }

  return <Breadcrumb items={title} />;
}

interface DashboardPageLayoutProps {
  icon?: React.ReactNode;
  /** Makes the page full height in the sense that it will take up the full height of the screen, and the content will scroll within that space */
  encapsulatedFullHeight?: boolean;
  title?: TitleProps['title'];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardPageLayout(props: DashboardPageLayoutProps) {
  const { icon, title, encapsulatedFullHeight, actions } = props;

  return (
    <>
      <VStack
        className="encapsulated-full-height z-[-1]"
        paddingY="xxsmall"
        paddingRight="xxsmall"
        fullWidth
        fullHeight
        position="absolute"
      >
        <VStack fullWidth fullHeight border></VStack>
      </VStack>
      <VStack
        className={cn(
          encapsulatedFullHeight && 'encapsulated-full-height',
          'max-w-[95%] mx-[auto]'
        )}
        gap={false}
        fullWidth
      >
        <HStack
          align="center"
          as="header"
          wrap
          justify="spaceBetween"
          fullWidth
          paddingX="large"
          paddingTop="xxlarge"
          paddingBottom="small"
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
    </>
  );
}
