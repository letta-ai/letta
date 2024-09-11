'use client';
import { Button, HStack, VStack } from '@letta-web/component-library';
import React from 'react';
import { usePathname } from 'next/navigation';
import { User2Icon } from 'lucide-react';

interface SidebarMenuItemProps {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

function SidebarMenuItem(props: SidebarMenuItemProps) {
  const { label, icon, href } = props;

  const pathname = usePathname();

  return (
    <HStack fullWidth as="li">
      <Button
        color="tertiary-transparent"
        fullWidth
        align="left"
        label={label}
        href={href}
        preIcon={icon}
        active={pathname === href}
      />
    </HStack>
  );
}

export function SettingsSidebar() {
  return (
    <HStack paddingLeft paddingY="large" as="aside" className="w-[250px]">
      <VStack fullWidth as="nav">
        <VStack fullWidth as="ul">
          <SidebarMenuItem
            icon={<User2Icon />}
            label="Profile"
            href="/settings/profile"
          />
        </VStack>
      </VStack>
    </HStack>
  );
}
