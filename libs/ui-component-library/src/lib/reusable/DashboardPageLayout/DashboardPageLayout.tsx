'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { BreadcrumbProps } from '../../core/Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../../core/Breadcrumb/Breadcrumb';
import './DashboardPageLayout.scss';
import { cn } from '@letta-cloud/ui-styles';
import Link from 'next/link';
import { ChevronLeftIcon } from '../../icons';
import { HiddenOnMobile } from '../../framing/HiddenOnMobile/HiddenOnMobile';
import { VisibleOnMobile } from '../../framing/VisibleOnMobile/VisibleOnMobile';
interface TitleProps {
  title?: BreadcrumbProps['items'] | string;
}

function Title({ title }: TitleProps) {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return (
      <Typography align="left" variant="heading2" overrideEl="h1">
        {title}
      </Typography>
    );
  }

  return <Breadcrumb size="xsmall" items={title} />;
}

interface DashboardPageLayoutProps {
  icon?: React.ReactNode;
  /** Makes the page full height in the sense that it will take up the full height of the screen, and the content will scroll within that space */
  encapsulatedFullHeight?: boolean;
  fullHeight?: boolean;
  headerBottomPadding?: 'default' | 'large';
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
    headerBottomPadding = 'default',
    fullHeight,
    encapsulatedFullHeight,
    actions,
  } = props;

  return (
    <VStack
      className={cn(
        encapsulatedFullHeight && 'encapsulated-full-height',
        fullHeight && 'h-full',
        'max-w-[95%] mx-[auto]',
      )}
      gap={false}
      fullWidth
    >
      <VStack fullWidth gap={false} className="max-w-[1398px] mx-auto" flex>
        <VStack
          gap="small"
          paddingX="large"
          paddingTop="xxlarge"
          paddingBottom={headerBottomPadding === 'large' ? 'xxlarge' : 'small'}
        >
          <VStack gap={false}>
            {returnButton && (
              <div className="flex mb-2">
                <HStack
                  paddingY="xxsmall"
                  paddingX="small"
                  gap={false}
                  className="ml-[-10px] hover:bg-secondary-hover"
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
              <HiddenOnMobile>
                <HStack align="center">{actions}</HStack>
              </HiddenOnMobile>
            </HStack>
          </VStack>
          {subtitle && (
            <VStack width="largeContained">
              <Typography variant="heading6">{subtitle}</Typography>
            </VStack>
          )}
          <VisibleOnMobile>
            <HStack paddingTop="medium" fullWidth>
              {actions}
            </HStack>
          </VisibleOnMobile>
        </VStack>
        <VStack fullWidth flex>
          {props.children}
        </VStack>
      </VStack>
    </VStack>
  );
}
