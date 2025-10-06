'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BetaTag,
  Button,
  ChevronDownIcon, Typography
} from '@letta-cloud/ui-component-library';
import { Frame, HStack, Logo } from '@letta-cloud/ui-component-library';
import { useCurrentProject } from '../../../../hooks/useCurrentProject/useCurrentProject';
import { NavigationOverlay } from '../NavigationOverlay/NavigationOverlay';
import { DashboardHeaderNavigation } from '../DashboardHeaderNavigation/DashboardHeaderNavigation';
import { ProfilePopover } from '../ProfilePopover/ProfilePopover';
import { CreditsPopover } from '../CreditsPopover/CreditsPopover';
import { ProjectSelector } from '../../../ProjectSelector/ProjectSelector';
import { usePathname } from 'next/navigation';
import { useCurrentOrganization } from '$web/client/hooks';
import { BillingTierBadge } from '$web/client/components/BillingTierBadge/BillingTierBadge';

export function DashboardHeader() {
  const currentProject = useCurrentProject();

  const pathname = usePathname();

  const isInSettings = useMemo(() => {
    return pathname.startsWith('/settings');
  }, [pathname]);

  const organization = useCurrentOrganization();

  const showOrganizationView = useMemo(() => {
    return organization && isInSettings;
  }, [organization, isInSettings]);

  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        color="background-grey"
        paddingY="xxsmall"
        position="fixed"
        zIndex="header"
        fullWidth
      >
        <HStack
          color="background-grey"
          fullWidth
          justify="spaceBetween"
          align="center"
          paddingY="large"
          paddingRight="small2"
          paddingLeft="xlarge"
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
                            contentOverride: (
                              <ProjectSelector
                                trigger={
                                  <Button
                                    size="xsmall"
                                    color="tertiary"
                                    postIcon={<ChevronDownIcon />}
                                    label={currentProject.name}
                                  />
                                }
                              />
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
                {showOrganizationView && (
                  <Link
                    href="/settings/organization/settings"
                    style={{ textDecoration: 'none' }}
                  >
                    <HStack
                      className="rounded-sm py-1"
                      paddingX="xsmall" border align="center" gap>
                      <Typography variant="body3">
                        {organization?.name || 'Organization'}
                      </Typography>
                      <BillingTierBadge size="small" />
                    </HStack>
                  </Link>
                )}
              </HStack>
            </HStack>
          </HStack>
          <HStack align="center" gap="small">
            <DashboardHeaderNavigation />
            <CreditsPopover />
            <ProfilePopover />
          </HStack>
        </HStack>
      </HStack>
    </>
  );
}
