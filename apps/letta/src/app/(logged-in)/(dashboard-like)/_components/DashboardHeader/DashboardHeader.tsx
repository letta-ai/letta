'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Avatar,
  Button,
  HStack,
  Logo,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';
import {
  // BirdIcon,
  DatabaseIcon,
  FolderOutputIcon,
  KeySquareIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
// import { webApi, webApiQueryKeys } from '$letta/client';

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

// function AdminNav() {
//   const { data } = webApi.organizations.getCurrentOrganization.useQuery({
//     queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
//   });
//
//   if (!data?.body.isAdmin) {
//     return null;
//   }
//
//   return <NavButton href="/admin" label="Admin" icon={<BirdIcon />} />;
// }

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

export function NavigationSidebar() {
  const [showMainNavigation, setShowMainNavigation] = useState(true);
  const subnavigationRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!subnavigationRef.current) {
      return;
    }

    const observe = new MutationObserver(() => {
      setShowMainNavigation(subnavigationRef.current?.children.length === 0);
    });

    observe.observe(subnavigationRef.current, {
      childList: true,
    });
  }, []);

  return (
    <VStack
      overflowY="auto"
      position="fixed"
      borderRight
      justify="spaceBetween"
      fullHeight
      className="z-[1] top-0 min-w-sidebar"
    >
      <VStack gap={false}>
        <HStack className="h-header" />
        <div ref={subnavigationRef} id="subnavigation" />
        {showMainNavigation && (
          <VStack paddingY="small" paddingX="small">
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
        )}
      </VStack>
      <HStack align="center" borderTop padding>
        <Logo color="muted" size="small" />
        <Typography color="muted" className="text-sm">
          Letta 2024
        </Typography>
      </HStack>
    </VStack>
  );
}
//
// function DashboardNavigation() {
//   const [open, setOpen] = useState(false);
//
//   const handleCloseOnClickInside = useCallback((event: React.MouseEvent) => {
//     event.stopPropagation();
//
//     setOpen(false);
//   }, []);
//
//   return (
//     <Popover
//       open={open}
//       onOpenChange={setOpen}
//       trigger={
//         <HStack gap="large" align="center">
//           {open ? <Cross2Icon /> : <HamburgerMenuIcon />}
//           <HStack>
//             <Logo />
//             <Typography className="text-lg">Letta</Typography>
//           </HStack>
//         </HStack>
//       }
//       align="start"
//     >
//       <VStack as="nav" padding="xxsmall" rounded color="background-grey">
//         <VStack gap="small">
//           <VStack
//             onClick={handleCloseOnClickInside}
//             padding="xxsmall"
//             rounded
//             color="background"
//           >
//             <NavButton
//               href="/projects"
//               label="Projects"
//               icon={<FolderOutputIcon />}
//             />
//             <NavButton
//               href="/api-keys"
//               label="API Keys"
//               icon={<KeySquareIcon />}
//             />
//             <NavButton
//               href="/data-sources"
//               label="Data Sources"
//               icon={<DatabaseIcon />}
//             />
//           </VStack>
//           <VStack padding="xxsmall" rounded color="background">
//             <NavButton href="/settings" label="Settings" icon={<CogIcon />} />
//             <AdminNav />
//             {/*<ThemeSwitcher />*/}
//             <NavButton href="/signout" label="Sign Out" icon={<ExitIcon />} />
//           </VStack>
//         </VStack>
//       </VStack>
//     </Popover>
//   );
// }

// function SubRoute() {
//   const pathname = usePathname();
//
//   const subRouteHref = pathname.split('/')[1];
//   const subRouteName = pathname.split('/')[1].replace(/\/|-/g, ' ');
//
//   if (!subRouteName) {
//     return null;
//   }
//
//   return (
//     <>
//       /
//       <Link className="hover:underline capitalize" href={`/${subRouteHref}`}>
//         {subRouteName}
//       </Link>
//     </>
//   );
// }

export function DashboardHeader() {
  const { name } = useCurrentUser();

  return (
    <>
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        position="fixed"
        borderBottom
        className="z-[2]"
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
              <Link href="/">
                <HStack align="center">
                  <Logo withText size="medium" />
                </HStack>
              </Link>
            </HStack>
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
      </HStack>
    </>
  );
}
