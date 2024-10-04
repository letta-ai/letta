'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import {
  Avatar,
  Button,
  CogIcon,
  Cross2Icon,
  ExitIcon,
  Frame,
  HamburgerMenuIcon,
  HStack,
  Logo,
  Popover,
  Typography,
  useDashboardNavigationItems,
  VStack,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';
import {
  ArrowLeft,
  BirdIcon,
  DatabaseIcon,
  FolderOutputIcon,
  KeySquareIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import { cn } from '@letta-web/core-style-config';
import { useTranslations } from 'next-intl';

interface NavButtonProps {
  href: string;
  preload?: boolean;
  label: string;
  icon?: React.ReactNode;
}

function NavButton(props: NavButtonProps) {
  const { href, preload, label, icon } = props;
  const pathname = usePathname();

  return (
    <Button
      preload={preload}
      active={pathname === href}
      href={href}
      fullWidth
      color="tertiary-transparent"
      align="left"
      label={label}
      preIcon={icon}
    />
  );
}

function AdminNav() {
  const t = useTranslations('dashboard-like/layout');

  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  if (!data?.body.isAdmin) {
    return null;
  }

  return <NavButton href="/admin" label={t('nav.admin')} icon={<BirdIcon />} />;
}

function MainNavigationItems() {
  const t = useTranslations('dashboard-like/layout');
  const pathname = usePathname();

  const { subnavigationData } = useDashboardNavigationItems();

  const specificSubNavigationData = useMemo(() => {
    const baseRoute = pathname.split('/');

    if (baseRoute.length <= 2) {
      return null;
    }

    return subnavigationData[`/${baseRoute[1]}`];
  }, [pathname, subnavigationData]);

  const navItems = useMemo(() => {
    if (!specificSubNavigationData) {
      return [
        {
          label: t('nav.projects'),
          href: '/projects',
          icon: <FolderOutputIcon />,
        },
        {
          label: t('nav.apiKeys'),
          href: '/api-keys',
          icon: <KeySquareIcon />,
        },
        {
          label: t('nav.dataSources'),
          href: '/data-sources',
          icon: <DatabaseIcon />,
        },
      ];
    }

    return specificSubNavigationData.items;
  }, [specificSubNavigationData, t]);

  const title = useMemo(() => {
    if (!specificSubNavigationData) {
      return '';
    }

    return specificSubNavigationData.title;
  }, [specificSubNavigationData]);

  return (
    <VStack>
      {specificSubNavigationData && (
        <HStack
          align="start"
          borderBottom
          paddingX="xsmall"
          paddingY="small"
          fullWidth
        >
          <Button
            color="tertiary-transparent"
            preIcon={<ArrowLeft />}
            label="Back"
            align="left"
            fullWidth
            href={specificSubNavigationData.returnPath}
          />
        </HStack>
      )}
      <VStack
        paddingX={specificSubNavigationData ? 'medium' : 'small'}
        paddingY="small"
        gap="large"
      >
        {title && <HStack align="center">{title}</HStack>}
        <VStack gap="small">
          {navItems.map((item) => (
            <NavButton
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}

function SecondaryMenuItems() {
  return (
    <VStack paddingX="small" gap="small">
      <NavButton href="/settings" label="Settings" icon={<CogIcon />} />
      <AdminNav />
      <NavButton
        preload={false}
        href="/signout"
        label="Sign Out"
        icon={<ExitIcon />}
      />
    </VStack>
  );
}

export function NavigationSidebar() {
  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-sidebar hidden visibleSidebar:block" />
      <VStack
        overflowY="auto"
        position="fixed"
        borderRight
        justify="spaceBetween"
        color="background"
        fullHeight
        zIndex="rightAboveZero"
        /* eslint-disable-next-line react/forbid-component-props */
        className="top-0 min-w-sidebar invisible visibleSidebar:visible"
      >
        <VStack gap={false}>
          {/* eslint-disable-next-line react/forbid-component-props */}
          <HStack className="h-header min-h-header" />
          <MainNavigationItems />
        </VStack>
        <HStack align="center" borderTop padding>
          <Logo color="muted" size="small" />
          <Typography color="muted" variant="body2">
            Letta 2024
          </Typography>
        </HStack>
      </VStack>
    </>
  );
}

function ProfilePopover() {
  const { name } = useCurrentUser();

  return (
    <Popover
      align="end"
      triggerAsChild
      trigger={
        <Button
          color="tertiary-transparent"
          label="Settings"
          hideLabel
          preIcon={<Avatar name={name} />}
        />
      }
    >
      <HStack borderBottom>
        <CurrentUserDetailsBlock hideSettingsButton />
      </HStack>
      <VStack paddingY="small">
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
        {open ? <Cross2Icon /> : <HamburgerMenuIcon />}
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
              borderLeft
              /* eslint-disable-next-line react/forbid-component-props */
              className={cn(
                'top-0 min-w-sidebar z-sidebarNav transition-all duration-200 slide-in-from-left left-0',
                !open ? 'ml-[-250px]' : 'ml-0'
              )}
              as="nav"
            >
              <VStack gap="small">
                <div className="h-header" />
                <MainNavigationItems />
                <HStack fullWidth borderBottom />
                <SecondaryMenuItems />
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

function SubRoute() {
  const pathname = usePathname();

  const subRouteHref = pathname.split('/')[1];
  const subRouteName = pathname.split('/')[1].replace(/\/|-/g, ' ');

  if (!subRouteName) {
    return null;
  }

  return (
    // eslint-disable-next-line react/forbid-component-props
    <HStack gap="medium" align="center" className="visibleSidebar:hidden flex">
      /{/* eslint-disable-next-line react/forbid-component-props */}
      <Link className="hover:underline capitalize" href={`/${subRouteHref}`}>
        {subRouteName}
      </Link>
    </HStack>
  );
}

export function DashboardHeader() {
  const t = useTranslations('dashboard-like/layout');
  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        position="fixed"
        borderBottom
        zIndex="header"
        fullWidth
        color="background"
      >
        <HStack
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
                </>
                <SubRoute />
              </HStack>
            </HStack>
          </HStack>
          <HStack align="center">
            <Button
              color="tertiary-transparent"
              target="_blank"
              href="https://docs.letta.com"
              label={t('header.Documentation')}
            />
            <ProfilePopover />
          </HStack>
        </HStack>
      </HStack>
    </>
  );
}
