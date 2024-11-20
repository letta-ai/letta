'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { BreadcrumbProps } from '../../core/Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../../core/Breadcrumb/Breadcrumb';
import './DashboardPageLayout.scss';
import { cn } from '@letta-web/core-style-config';
import Link from 'next/link';
import { ChevronLeftIcon } from '../../icons';
interface TitleProps {
  title?: BreadcrumbProps['items'] | string;
}

function Title({ title }: TitleProps) {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return (
      <Typography align="left" variant="heading1">
        {title}
      </Typography>
    );
  }

  return <Breadcrumb items={title} />;
}

interface DashboardPageLayoutProps {
  icon?: React.ReactNode;
  /** Makes the page full height in the sense that it will take up the full height of the screen, and the content will scroll within that space */
  encapsulatedFullHeight?: boolean;
  title?: TitleProps['title'];
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  returnButton?: {
    href: string;
    text: string;
  };
}

export function DashboardPageLayout(props: DashboardPageLayoutProps) {
  const {
    icon,
    title,
    returnButton,
    subtitle,
    encapsulatedFullHeight,
    actions,
  } = props;

  return (
    <>
      <VStack
        className={cn(
          encapsulatedFullHeight && 'encapsulated-full-height',
          'max-w-[95%] mx-[auto]'
        )}
        gap={false}
        fullWidth
      >
        <VStack
          gap={false}
          paddingX="large"
          paddingTop="xxlarge"
          paddingBottom="small"
        >
          <VStack gap={false}>
            {returnButton && (
              <div className="flex">
                <HStack
                  paddingY="xxsmall"
                  paddingX="small"
                  gap={false}
                  className="ml-[-10px] hover:bg-tertiary-hover"
                  align="center"
                >
                  <Link className="contents" href={returnButton.href}>
                    <ChevronLeftIcon size="small" />
                    <Typography bold variant="body3">
                      {returnButton.text}
                    </Typography>
                  </Link>
                </HStack>
              </div>
            )}
            <HStack
              align="center"
              as="header"
              wrap
              justify="spaceBetween"
              fullWidth
            >
              <HStack align="center">
                {icon}
                <Title title={title} />
              </HStack>
              <HStack align="center">{actions}</HStack>
            </HStack>
          </VStack>
          {subtitle && (
            <VStack>
              <Typography variant="heading5">{subtitle}</Typography>
            </VStack>
          )}
        </VStack>
        <VStack fullWidth collapseHeight>
          {props.children}
        </VStack>
      </VStack>
    </>
  );
}
