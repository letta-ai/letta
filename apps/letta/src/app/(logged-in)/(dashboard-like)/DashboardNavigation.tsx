'use client';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  CircleStackIcon,
  FolderIcon,
  Frame,
  HStack,
  KeyIcon,
  Typography,
} from '@letta-web/component-library';
import Link from 'next/link';
import { cn } from '@letta-web/core-style-config';
import { usePathname } from 'next/navigation';

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

export function DashboardNavigation() {
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
    </Frame>
  );
}
