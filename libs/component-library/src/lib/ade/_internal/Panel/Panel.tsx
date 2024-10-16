import type { PropsWithChildren } from 'react';
import React from 'react';
import { HStack } from '../../../framing/HStack/HStack';
import type { ADEDropdownMenuProps } from '../../ADEDropdownMenu/ADEDropdownMenu';
import { ADEDropdownMenu } from '../../ADEDropdownMenu/ADEDropdownMenu';
import { Typography } from '../../../core/Typography/Typography';
import { VStack } from '../../../framing/VStack/VStack';
import { cn } from '@letta-web/core-style-config';
import { CloseIcon, HamburgerMenuIcon } from '../../../icons';
import { Frame } from '../../../framing/Frame/Frame';

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
      borderRight
      borderBottom={!isActive}
      paddingRight="small"
      align="center"
      position="relative"
      fullWidth
      color={isActive ? 'background' : 'background-grey'}
    >
      <HStack
        as="button"
        fullWidth
        data-testid={`tab:${title}`}
        paddingLeft="large"
        paddingY="xsmall"
        className="h-full"
        onClick={onClickTab}
      >
        <Typography bold variant="body3" className="uppercase" noWrap>
          {title}
        </Typography>
      </HStack>
      <HStack className="mt-[-4px]" align="center" gap="small">
        <ADEDropdownMenu
          trigger={
            <div className="w-4">
              <HamburgerMenuIcon />
            </div>
          }
          items={dropdownItems}
        />
        <Frame className="w-4" as="button" onClick={onCloseTab}>
          <CloseIcon />
        </Frame>
      </HStack>
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
    <VStack border className={className} fullHeight gap={false}>
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
