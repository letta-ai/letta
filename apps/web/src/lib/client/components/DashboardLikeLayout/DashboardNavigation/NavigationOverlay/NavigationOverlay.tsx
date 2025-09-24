'use client';

import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import {
  CloseIcon,
  HamburgerMenuIcon,
  HStack,
  Logo,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import {
  NavigationMenu
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation/NavigationMenu/NavigationMenu';
import { SecondaryMenuItems } from '../SecondaryMenuItems/SecondaryMenuItems';

export const SIDEBAR_OVERLAY_MOUNT_POINT_ID = 'sidebar-overlay-mount-point';

export function NavigationOverlay() {
  const [open, setOpen] = useState(false);

  const handleCloseOnClickInside = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    setOpen(false);
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <HStack
        justify="start"
        as="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        gap="large"
        align="center"
      >
        {open ? <CloseIcon /> : <HamburgerMenuIcon />}
        <HStack>
          <Logo />
          {/* eslint-disable-next-line react/forbid-component-props */}
          <Typography className="text-lg">Letta</Typography>
        </HStack>
      </HStack>
      {mounted &&
        ReactDOM.createPortal(
          <>
            <VStack
              color="background"
              position="fixed"
              fullHeight
              /* eslint-disable-next-line react/forbid-component-props */
              className={cn(
                'top-0 min-w-sidebar max-w-sidebar z-sidebarNav transition-all duration-200 slide-in-from-left left-0',
                !open ? 'ml-[-300px]' : 'ml-0',
              )}
              overflowY="auto"
              as="nav"
              paddingBottom
            >
              <VStack gap="small">
                <div className="h-header" />
                <VStack>
                  <NavigationMenu isMobile />
                </VStack>
                <HStack fullWidth borderBottom />
                <SecondaryMenuItems isMobile />
              </VStack>
            </VStack>
            <div
              onClick={handleCloseOnClickInside}

              className={cn(
                'fixed fade-in-10 transition-all inset-0 bg-black bg-opacity-50 z-sidebarNavOverlay',
                open ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            />
          </>,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          document.getElementById(SIDEBAR_OVERLAY_MOUNT_POINT_ID)!,
        )}
    </>
  );
}
