import type { PropsWithChildren } from 'react';
import React from 'react';
import { HStack } from '../../../framing/HStack/HStack';
import type { ADEDropdownMenuProps } from '../../ADEDropdownMenu/ADEDropdownMenu';
import { ADEDropdownMenu } from '../../ADEDropdownMenu/ADEDropdownMenu';
import { Typography } from '../../../core/Typography/Typography';
import { VStack } from '../../../framing/VStack/VStack';
import { cn } from '@letta-web/core-style-config';
import { CaretDownIcon, Cross2Icon } from '../../../icons';

type GenericrPanelTabBarProps = PropsWithChildren;

export function GenericPanelTabBar(props: GenericrPanelTabBarProps) {
  const { children } = props;

  return (
    <HStack
      overflowY="hidden"
      className="min-h-[35px]"
      overflowX="auto"
      fullWidth
      gap={false}
    >
      {children}
    </HStack>
  );
}

interface GenericTabProps {
  dropdownItems: ADEDropdownMenuProps['items'];
  title: string;
  isActive?: boolean;
  onCloseTab?: () => void;
  onClickTab?: () => void;
}

export function GenericTab(props: GenericTabProps) {
  const { dropdownItems, title, isActive, onCloseTab, onClickTab } = props;

  return (
    <HStack
      paddingRight="small"
      align="center"
      position="relative"
      className="rounded-t-lg"
      color={isActive ? 'background' : 'background-grey'}
    >
      <HStack
        as="button"
        paddingLeft="large"
        paddingY="xsmall"
        className="h-full"
        onClick={onClickTab}
      >
        <Typography noWrap>{title}</Typography>
      </HStack>
      <ADEDropdownMenu
        trigger={
          <div className="w-2 mt-[-3px]">
            <CaretDownIcon />
          </div>
        }
        items={dropdownItems}
      />
      <HStack as="button" onClick={onCloseTab}>
        <Cross2Icon className="w-4" />
      </HStack>
      {isActive ? (
        <>
          <div className="w-4 h-4 absolute bottom-0 z-[2] right-[-16px] rounded-bl-[16px] bg-background-grey pointer-events-none" />
          <div className="w-4 h-4 absolute bottom-0 z-[1] right-[-16px] bg-background pointer-events-none" />
          <div className="w-4 h-4 absolute bottom-0 z-[2] left-[-16px] rounded-br-[16px] bg-background-grey pointer-events-none" />
          <div className="w-4 h-4 absolute bottom-0 z-[1] left-[-16px] bg-background pointer-events-none" />
        </>
      ) : (
        <div />
      )}
    </HStack>
  );
}

type GenericPanelContentProps = PropsWithChildren<{
  isActive?: boolean;
}>;

export function GenericPanelContent(props: GenericPanelContentProps) {
  const { children, isActive } = props;

  return (
    <VStack
      position="relative"
      color="background"
      className={cn(isActive ? 'flex' : 'hidden')}
      fullHeight
      fullWidth
    >
      {children}
    </VStack>
  );
}

interface GenericTabRendererProps {
  tabBar: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

export function GenericTabRenderer(props: GenericTabRendererProps) {
  const { tabBar, className, content } = props;

  return (
    <VStack className={className} fullHeight gap={false}>
      {tabBar}
      <VStack color="background" collapseHeight fullWidth>
        {content}
      </VStack>
    </VStack>
  );
}

type PanelForStorybookProps = PropsWithChildren<{
  title: string;
}>;

export function PanelForStorybook(props: PanelForStorybookProps) {
  const { children, title } = props;

  return (
    <HStack color="background-grey" className="h-[600px]">
      <GenericTabRenderer
        className="min-w-[500px] border-x border-b"
        tabBar={
          <GenericPanelTabBar>
            <GenericTab dropdownItems={[]} isActive title={title} />
          </GenericPanelTabBar>
        }
        content={children}
      />
    </HStack>
  );
}
