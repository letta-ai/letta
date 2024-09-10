'use client';
import type { ReactNode } from 'react';
import React from 'react';
import { useMemo } from 'react';
import {
  Avatar,
  Button,
  CircleStackIcon,
  FolderIcon,
  Frame,
  HStack,
  KeyIcon,
  Logo,
  Typography,
  VStack,
} from '@letta-web/component-library';
import Link from 'next/link';
import { cn } from '@letta-web/core-style-config';
import { usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import { DASHBOARD_HEADER_HEIGHT } from '$letta/client/common';
import { useCurrentUser } from '$letta/client/hooks';

interface NavigationItemProps {
  href: string;
  icon?: ReactNode;
  label: string;
}

function NavigationItem(props: NavigationItemProps) {
  const { href, icon, label } = props;
  const pathname = usePathname();

  const isActive = useMemo(() => {
    return pathname === href;
  }, [href, pathname]);

  return (
    <Frame as="li" fullWidth>
      <Link href={href}>
        <HStack
          as="button"
          color="tertiary"
          aria-current={isActive}
          className={cn(
            'hover:bg-tertiary-hover',
            isActive && 'bg-tertiary-active'
          )}
          padding="xsmall"
          paddingY="xxsmall"
          fullWidth
          align="center"
        >
          {icon}
          <Typography>{label}</Typography>
        </HStack>
      </Link>
    </Frame>
  );
}

function AdminNav() {
  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  if (!data?.body.isAdmin) {
    return null;
  }

  return (
    <NavigationItem href="/admin" label="Admin" icon={<Logo size="small" />} />
  );
}

function DashboardNavigation() {
  return (
    <Frame as="ul" fullWidth fullHeight>
      <NavigationItem
        href="/projects"
        label="All Projects"
        icon={<FolderIcon />}
      />
      <NavigationItem
        href="/data-sources"
        label="Data Sources"
        icon={<CircleStackIcon />}
      />
      <NavigationItem href="/api-keys" label="API Keys" icon={<KeyIcon />} />
      <AdminNav />
    </Frame>
  );
}

const SIDEBAR_WIDTH = 'w-[250px] min-w-[250px]';

export function DashboardSidebar() {
  const { name } = useCurrentUser();
  return (
    <VStack
      align="center"
      gap={false}
      fullHeight
      borderRight
      className={SIDEBAR_WIDTH}
    >
      <HStack
        align="center"
        paddingX="small"
        fullWidth
        borderBottom
        justify="spaceBetween"
        className={DASHBOARD_HEADER_HEIGHT}
      >
        <Link href="/">
          <HStack fullWidth align="center">
            <Logo /> Letta
          </HStack>
        </Link>
        <Button
          href="/settings"
          label="Settings"
          preIcon={<Avatar name={name} />}
          hideLabel
          color="tertiary-transparent"
        />
      </HStack>
      <VStack gap={false} as="nav" fullWidth fullHeight>
        <DashboardNavigation />
      </VStack>
    </VStack>
  );
}
