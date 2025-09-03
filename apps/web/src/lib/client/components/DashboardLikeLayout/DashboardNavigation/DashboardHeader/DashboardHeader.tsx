'use client';

import React from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BetaTag,
} from '@letta-cloud/ui-component-library';
import {
  Frame,
  HStack,
  Logo,
} from '@letta-cloud/ui-component-library';
import { useCurrentProject } from '../../../../hooks/useCurrentProject/useCurrentProject';
import { NavigationOverlay } from '../NavigationOverlay/NavigationOverlay';
import { DashboardHeaderNavigation } from '../DashboardHeaderNavigation/DashboardHeaderNavigation';
import { ProfilePopover } from '../ProfilePopover/ProfilePopover';

export function DashboardHeader() {
  const currentProject = useCurrentProject();

  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        color="background"
        padding="xxsmall"
        position="fixed"
        zIndex="header"
        fullWidth
      >
        <HStack
          color="background"
          fullWidth
          justify="spaceBetween"
          align="center"
          paddingX="large"
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-header min-h-header"
        >
          <HStack gap="large" align="center">
            <HStack fullWidth align="center">
              <HStack justify="start" align="center">
                <Breadcrumb
                  size="small"
                  items={[
                    {
                      label: 'root',
                      contentOverride: (
                        <>
                          {/* eslint-disable-next-line react/forbid-component-props */}
                          <Frame className="contents visibleSidebar:hidden">
                            <NavigationOverlay />
                          </Frame>
                          {/* eslint-disable-next-line react/forbid-component-props */}
                          <Frame className="hidden visibleSidebar:contents">
                            <Link href="/">
                              <HStack align="center" paddingRight="small">
                                <Logo withText size="medium" />
                                <BetaTag />
                              </HStack>
                            </Link>
                          </Frame>
                        </>
                      ),
                    },
                    ...(currentProject.name
                      ? [
                          {
                            label: currentProject.name,
                            href: currentProject.path,
                          },
                        ]
                      : []),
                  ]}
                />
              </HStack>
            </HStack>
          </HStack>
          <HStack align="center">
            <DashboardHeaderNavigation />
            <ProfilePopover />
          </HStack>
        </HStack>
      </HStack>
    </>
  );
}
