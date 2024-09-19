'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { Frame } from '../../framing/Frame/Frame';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from '../../core/Button/Button';
import './DashboardWithSidebarWrapper.scss';

interface NavItemProps {
  label: string;
  href: string;
  highlightSubPaths?: boolean;
}

function NavItem(props: NavItemProps) {
  const { label, href, highlightSubPaths } = props;
  const pathname = usePathname();

  const isActive = useMemo(() => {
    if (highlightSubPaths) {
      return pathname.startsWith(href);
    }

    return pathname === href;
  }, [pathname, href, highlightSubPaths]);

  return (
    <Button
      active={isActive}
      color="tertiary-transparent"
      label={label}
      href={href}
    />
  );
}

interface NavigationProps {
  projectTitle: React.ReactNode;
  items: NavItemProps[];
}

export function Navigation(props: NavigationProps) {
  const { projectTitle, items } = props;

  return (
    <VStack paddingX="large" gap="large" paddingY>
      <HStack align="center">{projectTitle}</HStack>
      <VStack>
        {items.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </VStack>
    </VStack>
  );
}

interface DashboardWithSidebarWrapperProps {
  children: React.ReactNode;
  navigationItems: NavItemProps[];
  projectTitle: React.ReactNode;
}

export function DashboardWithSidebarWrapper(
  props: DashboardWithSidebarWrapperProps
) {
  const { navigationItems, projectTitle, children } = props;
  return (
    <Frame fullWidth>
      <HStack fullWidth>
        <VStack gap={false} className="min-w-[250px] relative">
          <Navigation projectTitle={projectTitle} items={navigationItems} />
          <VStack
            borderRight
            fullHeight
            className="absolute top-0 z-[-1] overflow-hidden sidebar-bar ml-[250px]"
          />
        </VStack>
        <VStack fullWidth paddingBottom>
          {children}
        </VStack>
      </HStack>
    </Frame>
  );
}
