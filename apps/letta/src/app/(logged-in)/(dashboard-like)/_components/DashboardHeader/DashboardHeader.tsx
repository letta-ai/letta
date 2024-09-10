'use client';
import React, { useCallback, useState } from 'react';
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
  VStack,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';
import {
  BirdIcon,
  DatabaseIcon,
  FolderOutputIcon,
  KeySquareIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';

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

// function ThemeSwitcher() {
//   const { theme, setTheme } = useGlobalSessionSettings();
//
//
//   return (
//     <RawToggleGroup onValueChange={(v) => {
//       setTheme(v === 'dark' ? 'dark' : 'light');
//     }} value={theme} label="Theme" hideLabel items={[
//       {
//         icon: <MoonIcon />,
//         label: 'Dark',
//         hideLabel: true,
//         value: 'dark',
//       },
//       {
//         label: 'Light',
//         hideLabel: true,
//         icon: <SunIcon />,
//         value: 'light',
//       },
//     ]} />
//   )
//
// }

function DashboardNavigation() {
  const [open, setOpen] = useState(false);

  const handleCloseOnClickInside = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    setOpen(false);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      triggerAsChild
      trigger={
        <Button
          size="small"
          color="primary"
          hideLabel
          preIcon={open ? <Cross2Icon /> : <HamburgerMenuIcon />}
          active={open}
          label="Navigation"
        />
      }
      align="start"
    >
      <VStack as="nav" padding="xxxxsmall" rounded color="background-grey">
        <VStack gap="small">
          <VStack
            onClick={handleCloseOnClickInside}
            padding="xxxxsmall"
            rounded
            color="background"
          >
            <NavButton
              href="/projects"
              label="Projects"
              icon={<FolderOutputIcon />}
            />
            <NavButton
              href="/api-keys"
              label="API Keys"
              icon={<KeySquareIcon />}
            />
            <NavButton
              href="/data-sources"
              label="Data Sources"
              icon={<DatabaseIcon />}
            />
          </VStack>
          <VStack padding="xxxxsmall" rounded color="background">
            <NavButton href="/settings" label="Settings" icon={<CogIcon />} />
            <AdminNav />
            {/*<ThemeSwitcher />*/}
            <NavButton href="/signout" label="Sign Out" icon={<ExitIcon />} />
          </VStack>
        </VStack>
      </VStack>
    </Popover>
  );
}

export function DashboardHeader() {
  const { name } = useCurrentUser();

  return (
    <HStack
      fullWidth
      justify="spaceBetween"
      align="center"
      paddingX="small"
      className="max-w-[1440px] mx-[auto]"
    >
      <HStack gap="large" align="center">
        <DashboardNavigation />
        <Link href="/projects">
          <HStack fullWidth align="center">
            <Logo /> Letta
          </HStack>
        </Link>
      </HStack>
      <div>
        <Button
          href="/settings"
          color="tertiary-transparent"
          label="Settings"
          hideLabel
          preIcon={<Avatar name={name} />}
        />
      </div>
    </HStack>
  );
}
