'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import type { SubNavigationItem } from '@letta-web/component-library';
import {
  CreditCardIcon,
  GroupIcon,
  HiddenOnMobile,
} from '@letta-web/component-library';
import {
  Avatar,
  Button,
  CogIcon,
  CloseIcon,
  LogoutIcon,
  BirdIcon,
  DatabaseIcon,
  ProjectsIcon,
  KeyIcon,
  Frame,
  HamburgerMenuIcon,
  HStack,
  Logo,
  Popover,
  Typography,
  useDashboardNavigationItems,
  VStack,
  SwitchOrganizationIcon,
  ChevronLeftIcon,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';
import { usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import {
  CurrentUserDetailsBlock,
  ProjectSelector,
} from '$letta/client/components';
import { cn } from '@letta-web/core-style-config';
import { useTranslations } from 'next-intl';
import { ThemeSelector } from '$letta/client/components/ThemeSelector/ThemeSelector';
import { useCurrentProject } from '../../../../../app/(logged-in)/(dashboard-like)/projects/[projectSlug]/hooks';
import { LaptopIcon } from '@radix-ui/react-icons';
import { LocaleSelector } from '$letta/client/components/LocaleSelector/LocaleSelector';

interface NavButtonProps {
  href: string;
  preload?: boolean;
  label: string;
  id: string;
  active?: boolean;
  onClick?: () => void;
  hideLabel?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

function NavButton(props: NavButtonProps) {
  const {
    href,
    preload,
    onClick,
    active,
    disabled,
    hideLabel,
    label,
    id,
    icon,
  } = props;
  const pathname = usePathname();

  return (
    <Button
      animate
      disabled={disabled}
      data-testid={`nav-button-${id}`}
      preload={preload}
      onClick={onClick}
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

function AdminNav() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
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
    <NavButton
      id="admin"
      href="/admin"
      label={t('nav.admin')}
      icon={<BirdIcon />}
    />
  );
}

interface GroupHeaderProps {
  title: string;
}

function GroupHeader(props: GroupHeaderProps) {
  const { title } = props;
  return (
    <Frame borderBottom padding="small">
      <Typography bold variant="body2">
        {title}
      </Typography>
    </Frame>
  );
}

const UNCATEGORIZED_GROUP = 'uncategorized';
interface MainNavigationItemsProps {
  isMobile?: boolean;
}

function MainNavigationItems(props: MainNavigationItemsProps) {
  const { isMobile } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
  );

  const currentUser = useCurrentUser();

  const hasCloudAccess = useMemo(() => {
    return currentUser?.hasCloudAccess;
  }, [currentUser]);

  const pathname = usePathname();

  const { subnavigationData } = useDashboardNavigationItems();

  const pathroot = pathname.split('/')[1];

  const baseNavItems = useMemo(() => {
    return [
      {
        label: t('nav.projects'),
        href: '/projects',
        id: 'projects',
        icon: <ProjectsIcon />,
      },
      {
        label: t('nav.localDev'),
        href: '/development-servers',
        id: 'development-servers',
        icon: <LaptopIcon />,
        doesNotNeedCloudAccess: true,
      },
      {
        label: t('nav.apiKeys'),
        href: '/api-keys',
        id: 'api-keys',
        icon: <KeyIcon />,
      },
      {
        label: t('nav.dataSources'),
        href: '/data-sources',
        id: 'data-sources',
        icon: <DatabaseIcon />,
      },
      {
        label: t('nav.team'),
        href: '/settings/organization/members',
        id: 'team',
        icon: <GroupIcon />,
      },
      {
        label: t('nav.billing'),
        href: '/settings/organization/billing',
        id: 'usage',
        icon: <CreditCardIcon />,
      },
      {
        label: t('nav.settings'),
        href: '/settings',
        id: 'usage',
        icon: <CogIcon />,
        doesNotNeedCloudAccess: true,
      },
    ].filter((item) => {
      if (item.doesNotNeedCloudAccess) {
        return true;
      }

      return hasCloudAccess;
    });
  }, [t, hasCloudAccess]);

  const isBaseNav = useMemo(() => {
    const isBase = baseNavItems.some((item) => item.href === pathname);

    if (pathname.includes('settings')) {
      return false;
    }

    return isBase;
  }, [baseNavItems, pathname]);

  const specificSubNavigationData = useMemo(() => {
    const baseRoute = pathname.split('/');

    if (baseRoute.length <= 2) {
      return null;
    }

    return subnavigationData[`/${baseRoute[1]}`];
  }, [pathname, subnavigationData]);

  const subNavItems = useMemo(() => {
    if (!specificSubNavigationData) {
      return {};
    }

    return specificSubNavigationData.items.reduce((acc, item) => {
      let group = UNCATEGORIZED_GROUP;

      if (item.group) {
        group = item.group;
      }

      if (!acc[group]) {
        acc[group] = [];
      }

      acc[group].push(item);

      return acc;
    }, {} as Record<string, SubNavigationItem[]>);
  }, [specificSubNavigationData]);

  const title = useMemo(() => {
    if (!specificSubNavigationData) {
      return '';
    }

    return specificSubNavigationData.title;
  }, [specificSubNavigationData]);

  return (
    <VStack fullHeight={!isMobile} gap={false}>
      <HStack
        fullHeight={!isMobile}
        paddingTop={isMobile ? 'large' : false}
        gap={false}
      >
        {!isMobile && (
          <VStack
            fullWidth={isBaseNav}
            padding="small"
            borderRight={!isBaseNav}
          >
            <VStack
              fullWidth={isBaseNav}
              gap="small"
              /*eslint-disable-next-line react/forbid-component-props*/
              className="min-w-[36px]"
            >
              {baseNavItems.map((item) => (
                <NavButton
                  id={item.id}
                  key={item.href}
                  href={item.href}
                  active={pathroot === item.id}
                  label={item.label}
                  icon={item.icon}
                  hideLabel={!isBaseNav}
                />
              ))}
            </VStack>
          </VStack>
        )}
        {!isBaseNav && (
          <VStack fullWidth>
            <VStack padding={isMobile ? undefined : 'small'} fullWidth>
              {!isMobile && hasCloudAccess && (
                <HStack
                  align="start"
                  borderBottom
                  paddingBottom="small"
                  fullWidth
                >
                  <Button
                    size="small"
                    color="tertiary-transparent"
                    preIcon={<ChevronLeftIcon />}
                    label="Back"
                    align="left"
                    fullWidth
                    href={specificSubNavigationData?.returnPath || '/'}
                  />
                </HStack>
              )}
              {title && (
                <HStack
                  justify="start"
                  align="center"
                  paddingX={isMobile ? 'small' : undefined}
                >
                  {title}
                </HStack>
              )}
              <VStack gap="small">
                {Object.entries(subNavItems).map(([group, items]) => {
                  if (group === UNCATEGORIZED_GROUP) {
                    return (
                      <VStack
                        gap="small"
                        key={group}
                        paddingX={isMobile ? 'small' : undefined}
                        paddingBottom={isMobile ? 'small' : undefined}
                      >
                        {items.map((item) => (
                          <NavButton
                            id={item.id}
                            key={item.href}
                            icon={item.icon}
                            href={item.href}
                            label={item.label}
                          />
                        ))}
                      </VStack>
                    );
                  }

                  return (
                    <VStack key={group} gap="small" paddingBottom="small">
                      <GroupHeader title={group} />
                      <VStack
                        gap="small"
                        paddingX={isMobile ? 'small' : undefined}
                      >
                        {items.map((item) => (
                          <NavButton
                            id={item.id}
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            label={item.label}
                          />
                        ))}
                      </VStack>
                    </VStack>
                  );
                })}
              </VStack>
            </VStack>
          </VStack>
        )}
      </HStack>
      {isMobile && (
        <VStack gap="small">
          {isMobile && !isBaseNav && <GroupHeader title={t('rootTitle')} />}
          <VStack
            paddingX="small"
            fullWidth
            paddingTop={!isBaseNav ? 'small' : undefined}
            paddingBottom="small"
            gap="small"
          >
            {baseNavItems.map((item) => (
              <NavButton
                id={item.id}
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}

interface SecondaryMenuItemsProps {
  isMobile?: boolean;
}

function SecondaryMenuItems(props: SecondaryMenuItemsProps) {
  const { isMobile } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
  );

  return (
    <VStack gap="medium">
      <VStack gap={false}>
        <VStack borderBottom gap="small" padding="small">
          {!isMobile && (
            <NavButton
              id="settings"
              href="/settings"
              label={t('secondaryNav.settings')}
              icon={<CogIcon />}
            />
          )}
          <AdminNav />
          <NavButton
            id="select-organization"
            href="/select-organization"
            label={t('secondaryNav.switchOrganizations')}
            icon={<SwitchOrganizationIcon />}
          />
          <NavButton
            id="sign-out"
            preload={false}
            href="/signout"
            label={t('secondaryNav.signOut')}
            icon={<LogoutIcon />}
          />
        </VStack>
      </VStack>
      <HStack justify="spaceBetween" paddingX="small">
        <LocaleSelector />
        <ThemeSelector />
      </HStack>
    </VStack>
  );
}

export function NavigationSidebar() {
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
            <MainNavigationItems />
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

  return (
    <Popover
      align="end"
      triggerAsChild
      trigger={
        <Button
          color="tertiary-transparent"
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
      <HStack borderBottom>
        <CurrentUserDetailsBlock hideSettingsButton />
      </HStack>
      <VStack paddingBottom="small">
        <SecondaryMenuItems />
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
                !open ? 'ml-[-300px]' : 'ml-0'
              )}
              overflowY="auto"
              as="nav"
              paddingBottom
            >
              <VStack gap="small">
                <div className="h-header" />
                <VStack>
                  <MainNavigationItems isMobile />
                </VStack>
                <HStack fullWidth borderBottom />
                <SecondaryMenuItems isMobile />
              </VStack>
            </VStack>
            <div
              onClick={handleCloseOnClickInside}
              /* eslint-disable-next-line react/forbid-component-props */
              className={cn(
                'fixed fade-in-10 transition-all inset-0 bg-black bg-opacity-50 z-sidebarNavOverlay',
                open ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            />
          </>,
          document.getElementById(SIDEBAR_OVERLAY_MOUNT_POINT_ID)!
        )}
    </>
  );
}

export function DashboardHeader() {
  const currentProject = useCurrentProject();

  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
  );
  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        padding="xxsmall"
        position="fixed"
        zIndex="header"
        fullWidth
      >
        <HStack
          border
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
              <HStack align="center">
                <>
                  {/* eslint-disable-next-line react/forbid-component-props */}
                  <Frame className="contents visibleSidebar:hidden">
                    <NavigationOverlay />
                  </Frame>
                  {/* eslint-disable-next-line react/forbid-component-props */}
                  <Frame className="hidden visibleSidebar:contents">
                    <Link href="/">
                      <Logo withText size="medium" />
                    </Link>
                  </Frame>

                  {currentProject.id && (
                    <>
                      <HStack paddingLeft="small">/</HStack>
                      <ProjectSelector />
                    </>
                  )}
                </>
              </HStack>
            </HStack>
          </HStack>
          <HStack align="center">
            <HiddenOnMobile>
              <Button
                color="tertiary-transparent"
                target="_blank"
                href="https://docs.letta.com"
                label={t('header.Documentation')}
              />
            </HiddenOnMobile>
            <ProfilePopover />
          </HStack>
        </HStack>
      </HStack>
    </>
  );
}
