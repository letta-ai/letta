'use client';
import React, { useEffect } from 'react';
import { HomeIcon, HStack, VStack, Button } from '@letta-web/component-library';
import { usePathname } from 'next/navigation';
import type { AdminNavigationItemProps } from '../../types';
import { NavigationItems } from '../../constants';

function NavigationItem(props: AdminNavigationItemProps) {
  const { href, preload, active, hideLabel, label, id, icon } = props;
  const pathname = usePathname();

  return (
    <Button
      animate
      data-testid={`nav-button-${id}`}
      preload={preload}
      active={active || pathname === href}
      href={href}
      hideLabel={hideLabel}
      fullWidth
      color="tertiary-transparent"
      align="left"
      label={label}
      preIcon={icon}
    />
  );
}

export function AdminNavigation() {
  useEffect(() => {
    document.body.className = 'hacker';
    document.body.dataset['mode'] = 'hacker';
  }, []);

  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-sidebar max-w-sidebar hidden visibleSidebar:block" />
      <VStack
        overflowY="auto"
        position="fixed"
        justify="spaceBetween"
        color="background"
        fullHeight
        zIndex="rightAboveZero"
        /* eslint-disable-next-line react/forbid-component-props */
        className="top-0 min-w-sidebar h-full max-w-sidebar invisible visibleSidebar:visible"
      >
        <VStack fullHeight gap="small" padding="xxsmall">
          {/* eslint-disable-next-line react/forbid-component-props */}
          <HStack className="h-header min-h-header" />
          <VStack fullHeight border>
            <VStack padding="small">
              <NavigationItem
                id="home"
                href="/admin"
                label="Home"
                icon={<HomeIcon />}
              />
              {NavigationItems.map((item) => (
                <NavigationItem key={item.id} {...item} />
              ))}
            </VStack>
          </VStack>
        </VStack>
      </VStack>
    </>
  );
}
