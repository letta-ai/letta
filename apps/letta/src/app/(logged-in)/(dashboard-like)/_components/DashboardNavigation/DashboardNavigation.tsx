'use client';
import React, { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import {
  Avatar,
  Button,
  CogIcon,
  Cross2Icon,
  ExitIcon,
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

interface NavButtonProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

function NavButton(props: NavButtonProps) {
  const { href, label, icon } = props;
  const pathname = usePathname();

  return (
    <Button
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
  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  if (!data?.body.isAdmin) {
    return null;
  }

  return <NavButton href="/admin" label="Admin" icon={<BirdIcon />} />;
}

function MainNavigationItems() {
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
          label: 'Projects',
          href: '/projects',
          icon: <FolderOutputIcon />,
        },
        {
          label: 'API Keys',
          href: '/api-keys',
          icon: <KeySquareIcon />,
        },
        {
          label: 'Data Sources',
          href: '/data-sources',
          icon: <DatabaseIcon />,
        },
      ];
    }

    return specificSubNavigationData.items;
  }, [specificSubNavigationData]);

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
      <NavButton href="/signout" label="Sign Out" icon={<ExitIcon />} />
    </VStack>
  );
}

export function NavigationSidebar() {
  return (
    <>
      <VStack className="min-w-sidebar hidden visibleSidebar:block" />
      <VStack
        overflowY="auto"
        position="fixed"
        borderRight
        justify="spaceBetween"
        fullHeight
        className="z-[1] top-0 min-w-sidebar invisible visibleSidebar:visible"
      >
        <VStack gap={false}>
          <HStack className="h-header" />
          <MainNavigationItems />
        </VStack>
        <HStack align="center" borderTop padding>
          <Logo color="muted" size="small" />
          <Typography color="muted" className="text-sm">
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
      <CurrentUserDetailsBlock hideSettingsButton />
      <SecondaryMenuItems />
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
          <Typography className="text-lg">Letta</Typography>
        </HStack>
      </HStack>
      {open &&
        ReactDOM.createPortal(
          <>
            <VStack
              color="background"
              position="fixed"
              fullHeight
              borderLeft
              className={`top-0 min-w-sidebar z-sidebarNav transition-all duration-200 slide-in-from-left left-0 `}
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
              className="fixed fade-in-10 inset-0 bg-black bg-opacity-50 z-sidebarNavOverlay"
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
    <HStack
      gap="medium"
      align="center"
      className="font-medium visibleSidebar:hidden flex"
    >
      /
      <Link className="hover:underline capitalize" href={`/${subRouteHref}`}>
        {subRouteName}
      </Link>
    </HStack>
  );
}

export function DashboardHeader() {
  return (
    <>
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        position="fixed"
        borderBottom
        className="z-header"
        fullWidth
        color="background"
      >
        <HStack
          fullWidth
          justify="spaceBetween"
          align="center"
          paddingX="large"
          className="h-header min-h-header"
        >
          <HStack gap="large" align="center">
            <HStack fullWidth align="center">
              <HStack align="center">
                <>
                  <div className="contents visibleSidebar:hidden">
                    <NavigationOverlay />
                  </div>
                  <div className="hidden visibleSidebar:contents">
                    <Link href="/">
                      <Logo withText size="medium" />
                    </Link>
                  </div>
                </>
                <SubRoute />
              </HStack>
            </HStack>
          </HStack>
          <div>
            <ProfilePopover />
          </div>
        </HStack>
      </HStack>
    </>
  );
}
