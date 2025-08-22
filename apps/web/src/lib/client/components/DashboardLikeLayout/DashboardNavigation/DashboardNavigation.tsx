'use client';
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import {
  DiscordLogoMarkDynamic,
  Breadcrumb,
  GroupAddIcon,
  BetaTag,
} from '@letta-cloud/ui-component-library';
import { HiddenOnMobile } from '@letta-cloud/ui-component-library';
import {
  AccountIcon,
  Avatar,
  Button,
  CloseIcon,
  LogoutIcon,
  BirdIcon,
  KeyIcon,
  Frame,
  HamburgerMenuIcon,
  HStack,
  Logo,
  Popover,
  Typography,
  VStack,
  SwitchOrganizationIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentUser } from '$web/client/hooks';
import { webApi, webApiQueryKeys } from '$web/client';
import { CurrentUserDetailsBlock } from '$web/client/components';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import './DashboardNavigation.scss';
import { OrganizationUsageBlock } from '$web/client/components/OrganizationUsageBlock/OrganizationUsageBlock';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import { show as startIntercom } from '@intercom/messenger-js-sdk';
import {
  DashboardNavigationButton
} from './DashboardNavigationButton/DashboardNavigationButton';
import {
  NavigationMenu
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation/NavigationMenu/NavigationMenu';
import { ThemeSelector } from '$web/client/components/ThemeSelector/ThemeSelector';
import { LocaleSelector } from '$web/client/components/LocaleSelector/LocaleSelector';


function AdminNav() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );
  const user = useCurrentUser();

  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
    enabled: !!user?.activeOrganizationId,
  });

  if (!data?.body.isAdmin) {
    return null;
  }

  return (
    <DashboardNavigationButton
      id="admin"
      href="/admin"
      label={t('nav.admin')}
      icon={<BirdIcon />}
    />
  );
}


interface SecondaryMenuItemsProps {
  isMobile?: boolean;
}

function SecondaryMenuItems(props: SecondaryMenuItemsProps) {
  const { isMobile } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <VStack gap="medium">
      <VStack gap={false}>
        <VStack borderBottom gap={false}>
          {!isMobile && (
            <DashboardNavigationButton
              id="settings"
              href="/settings/organization/account"
              label={t('secondaryNav.account')}
              icon={<AccountIcon />}
            />
          )}
          <AdminNav />
          <DashboardNavigationButton
            id="api-keys"
            href="/api-keys"
            label={t('secondaryNav.apiKeys')}
            icon={<KeyIcon />}
          />
          <DashboardNavigationButton
            id="select-organization"
            href="/settings/organization/members"
            label={t('secondaryNav.addMembers')}
            icon={<GroupAddIcon />}
          />
          <DashboardNavigationButton
            id="select-organization"
            href="/select-organization"
            label={t('secondaryNav.switchOrganizations')}
            icon={<SwitchOrganizationIcon />}
          />
          <DashboardNavigationButton
            id="sign-out"
            preload={false}
            href="/signout"
            label={t('secondaryNav.signOut')}
            icon={<LogoutIcon />}
          />
        </VStack>
      </VStack>
      <HStack justify="spaceBetween" paddingX="small" align="center">
        <LocaleSelector />
        <ThemeSelector />
      </HStack>
    </VStack>
  );
}

export function NavigationSidebar() {
  const systemWarning = useGlobalSystemWarning();

  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-[180px] h-full max-w-[180px] hidden visibleSidebar:block" />
      <VStack
        overflowY="auto"
        position="fixed"
        justify="spaceBetween"
        color="background"
        fullHeight
        zIndex="rightAboveZero"
        /* eslint-disable-next-line react/forbid-component-props */
        className={`top-0 min-w-[180px] h-full max-w-[180px] invisible visibleSidebar:visible ${systemWarning ? 'system-warning-sidebar' : ''}`}
      >
        <VStack fullHeight gap="small" paddingY="xxsmall" paddingLeft="xxsmall">
          {/* eslint-disable-next-line react/forbid-component-props */}
          <HStack className="h-header min-h-header" />
          <VStack
            fullHeight
            borderY
            borderLeft
            /* eslint-disable-next-line react/forbid-component-props */
            className="main-sidebar border-background-grey3-border"
          >
            <NavigationMenu />
          </VStack>
        </VStack>
      </VStack>
    </>
  );
}

interface ProfilePopoverProps {
  size?: 'large' | 'medium' | 'small';
}

export function ProfilePopover(props: ProfilePopoverProps) {
  const user = useCurrentUser();
  const { size } = props;

  if (!user) {
    return null;
  }

  return (
    <Popover
      align="end"
      triggerAsChild
      /* eslint-disable-next-line react/forbid-component-props */
      className="border-background-grey3-border"
      trigger={
        <Button
          color="tertiary"
          label="Settings"
          hideLabel
          preIcon={
            <Avatar
              imageSrc={user?.imageUrl || ''}
              size={size}
              name={user?.name || ''}
            />
          }
        />
      }
    >
      <VStack color="background-grey2" gap={false}>
        <HStack borderBottom>
          <CurrentUserDetailsBlock />
        </HStack>
        <HStack borderBottom>
          <OrganizationUsageBlock />
        </HStack>
        <VStack paddingBottom="small">
          <SecondaryMenuItems />
        </VStack>
      </VStack>
    </Popover>
  );
}

export const SIDEBAR_OVERLAY_MOUNT_POINT_ID = 'sidebar-overlay-mount-point';

function NavigationOverlay() {
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
          document.getElementById(SIDEBAR_OVERLAY_MOUNT_POINT_ID)!,
        )}
    </>
  );
}

function ShowIntercom() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <Button
      label={t('DashboardHeaderNavigation.supportPopover.bugReport.start')}
      onClick={startIntercom}
      color="secondary"
      align="center"
      fullWidth
    />
  );
}

interface DashboardHeaderNavigationProps {
  preItems?: React.ReactNode;
}

export function DashboardHeaderNavigation(
  props: DashboardHeaderNavigationProps,
) {
  const { preItems } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <HiddenOnMobile>
      <HStack gap="small" align="center">
        {preItems}
        <Popover
          triggerAsChild
          trigger={
            <Button
              size="xsmall"
              color="tertiary"
              label={t('DashboardHeaderNavigation.support')}
            />
          }
        >
          <VStack gap="large" borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.bugReport.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.bugReport.description',
              )}
            </Typography>
            <ShowIntercom />
          </VStack>
          <VStack gap="large" borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.discord.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.discord.description',
              )}
            </Typography>
            <a
              target="_blank"
              rel="noreferrer"
              className="px-3 flex justify-center items-center gap-2 py-2 text-white bg-[#7289da]"
              href="https://discord.gg/letta"
            >
              { }
              <DiscordLogoMarkDynamic size="small" />
              <Typography bold>
                {t('DashboardHeaderNavigation.supportPopover.discord.joinUs')}
              </Typography>
            </a>
          </VStack>
        </Popover>
        <Button
          size="xsmall"
          color="tertiary"
          target="_blank"
          label={t('DashboardHeaderNavigation.documentation')}
          href="https://docs.letta.com/introduction"
        />
        <Button
          size="xsmall"
          color="tertiary"
          target="_blank"
          label={t('DashboardHeaderNavigation.apiReference')}
          href="https://docs.letta.com/api-reference"
        />
      </HStack>
    </HiddenOnMobile>
  );
}

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
