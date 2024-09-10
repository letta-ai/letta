'use client';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  Frame,
  HomeIcon,
  HStack,
  Typography,
} from '@letta-web/component-library';
import Link from 'next/link';
import { cn } from '@letta-web/core-style-config';
import { usePathname } from 'next/navigation';
import { ListIcon } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

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
          <Slot className="w-4">{icon}</Slot>
          <Typography>{label}</Typography>
        </HStack>
      </Link>
    </Frame>
  );
}

export function AdminNavigation() {
  return (
    <Frame as="ul" fullWidth fullHeight>
      <NavigationItem href="/admin" label="Home" icon={<HomeIcon />} />
      <NavigationItem
        href="/admin/whitelist"
        label="Manage Whitelist"
        icon={<ListIcon />}
      />
    </Frame>
  );
}
