'use client';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import {
  DiscordLogoMarkDynamic,
  ProjectsIcon,
  isSubNavigationGroup,
  Breadcrumb,
  isSubNavigationOverride,
  TokenIcon,
  GroupAddIcon,
  BetaTag,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { HiddenOnMobile } from '@letta-cloud/ui-component-library';
import {
  AccountIcon,
  Avatar,
  Button,
  BarChartIcon,
  CogIcon,
  CloseIcon,
  LogoutIcon,
  BirdIcon,
  DatabaseIcon,
  KeyIcon,
  Frame,
  HamburgerMenuIcon,
  HStack,
  Logo,
  PersonIcon,
  Popover,
  Typography,
  useDashboardNavigationItems,
  VStack,
  SwitchOrganizationIcon,
  ChevronLeftIcon,
  LaptopIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { usePathname } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$web/client';
import { CurrentUserDetailsBlock } from '$web/client/components';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';
import { ThemeSelector } from '$web/client/components/ThemeSelector/ThemeSelector';
import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { LocaleSelector } from '$web/client/components/LocaleSelector/LocaleSelector';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import './DashboardNavigation.scss';
import { OrganizationUsageBlock } from '$web/client/components/OrganizationUsageBlock/OrganizationUsageBlock';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import { show as startIntercom } from '@intercom/messenger-js-sdk';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

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

  const isActive = useMemo(() => {
    if (active) {
      return true;
    }

    return pathname === href;
  }, [active, pathname, href]);

  return (
    <Button
      animate
      disabled={disabled}
      data-testid={`nav-button-${id}`}
      preload={preload}
      _use_rarely_className={cn(
        'font-medium',
        hideLabel ? '' : 'px-2',
        !isActive ? 'text-text-lighter' : '',
      )}
      onClick={onClick}
      active={isActive}
      href={href}
      square={hideLabel}
      hideLabel={hideLabel}
      fullWidth
      color={isActive ? 'brand' : 'tertiary'}
      align="left"
      label={label}
      preIcon={icon}
    />
  );
}

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

interface MainNavigationItemsProps {
  isMobile?: boolean;
}

function MainNavigationItems(props: MainNavigationItemsProps) {
  const { isMobile } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  const pathname = usePathname();

  const { subnavigationData } = useDashboardNavigationItems();

  const { data: areToolsOnDashboardEnabled } =
    useFeatureFlag('TOOLS_ON_DASHBOARD');

  const pathroot = pathname.split('/')[1];

  const [canReadAPIKeys] = useUserHasPermission(
    ApplicationServices.READ_API_KEYS,
  );

  const baseNavItems = useMemo(() => {
    return [
      {
        label: t('nav.projects'),
        href: '/projects',
        id: 'projects',
        icon: <ProjectsIcon />,
      },
      ...(areToolsOnDashboardEnabled
        ? [
            {
              label: t('nav.tools'),
              href: '/tools',
              id: 'tools',
              icon: <ToolsIcon />,
            },
          ]
        : []),
      {
        label: t('nav.dataSources'),
        href: '/data-sources',
        id: 'data-sources',
        icon: <DatabaseIcon />,
      },
      {
        label: t('nav.models'),
        href: '/models',
        id: 'models',
        icon: <TokenIcon />,
      },

      ...(canReadAPIKeys
        ? [
            {
              label: t('nav.apiKeys'),
              href: '/api-keys',
              id: 'api-keys',
              icon: <KeyIcon />,
            },
          ]
        : []),
      {
        borderTop: true,
        label: t('nav.localDev'),
        href: '/development-servers',
        id: 'development-servers',
        icon: <LaptopIcon />,
        doesNotNeedCloudAccess: true,
      },
    ];
  }, [t, areToolsOnDashboardEnabled, canReadAPIKeys]);

  const baseNavBottomItems = [
    {
      label: t('nav.account'),
      href: '/settings/profile',
      id: 'usage',
      icon: <PersonIcon />,
      doesNotNeedCloudAccess: true,
    },
    {
      label: t('nav.billing'),
      href: '/settings/organization/billing',
      id: 'billing',
      icon: <BarChartIcon />,
    },
    {
      label: t('nav.settings'),
      href: '/settings/organization/account',
      id: 'usage',
      icon: <CogIcon />,
    },
  ];
  const isBaseNav = useMemo(() => {
    const isBase = baseNavItems.some((item) => item.href === pathname);

    if (pathname.includes('settings')) {
      return false;
    }

    if (pathname.includes('tools')) {
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
      return [];
    }

    return specificSubNavigationData.items;
  }, [specificSubNavigationData]);

  const title = useMemo(() => {
    if (!specificSubNavigationData) {
      return '';
    }

    return specificSubNavigationData.title;
  }, [specificSubNavigationData]);

  const returnText = useMemo(() => {
    if (!specificSubNavigationData) {
      return t('back');
    }

    return specificSubNavigationData.returnText || t('back');
  }, [specificSubNavigationData, t]);

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
            padding={isBaseNav ? 'small' : 'xsmall'}
            paddingY="small"
            borderRight={!isBaseNav}
            justify="spaceBetween"
            /*eslint-disable-next-line react/forbid-component-props*/
            className={!isBaseNav ? 'border-r-background-grey3-border' : ''}
            /*eslint-disable-next-line react/forbid-component-props*/
            style={{ minWidth: '56px' }}
          >
            <VStack gap={false}>
              {baseNavItems.map((item) => {
                if (item.id === 'development-servers') {
                  return (
                    <VStack
                      key={item.href}
                      fullWidth
                      borderTop
                      paddingY="xsmall"
                      /*eslint-disable-next-line react/forbid-component-props*/
                      className="border-t-background-grey3-border"
                    >
                      <NavButton
                        id={item.id}
                        key={item.href}
                        href={item.href}
                        active={pathroot === item.id}
                        label={item.label}
                        icon={item.icon}
                        hideLabel={!isBaseNav}
                      />
                    </VStack>
                  );
                }

                return (
                  <NavButton
                    id={item.id}
                    key={item.href}
                    href={item.href}
                    active={pathroot === item.id}
                    label={item.label}
                    icon={item.icon}
                    hideLabel={!isBaseNav}
                  />
                );
              })}
            </VStack>
            <VStack>
              {baseNavBottomItems.map((item) => (
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
              {!isMobile && (
                <HStack
                  align="start"
                  borderBottom
                  paddingBottom="small"
                  fullWidth
                  /*eslint-disable-next-line react/forbid-component-props*/
                  className="border-b-background-grey3-border"
                >
                  <Button
                    size="small"
                    color="tertiary"
                    preIcon={<ChevronLeftIcon />}
                    label={returnText}
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
              <VStack gap={false}>
                {subNavItems.map((item, index) => {
                  if (isSubNavigationGroup(item)) {
                    const { title, titleOverride, items: groupItems } = item;

                    return (
                      <VStack key={title} gap="small" paddingBottom="small">
                        <Frame
                          borderTop={index !== 0}
                          paddingTop={false}
                          padding="small"
                          /*eslint-disable-next-line react/forbid-component-props*/
                          className={
                            index !== 0
                              ? 'border-t-background-grey3-border'
                              : ''
                          }
                        >
                          {titleOverride ? (
                            titleOverride
                          ) : (
                            <Typography bold variant="body2">
                              {title}
                            </Typography>
                          )}
                        </Frame>
                        <VStack gap="small">
                          {groupItems.map((item, index) => {
                            if (isSubNavigationOverride(item)) {
                              return (
                                <Fragment key={index}>{item.override}</Fragment>
                              );
                            }

                            return (
                              <NavButton
                                id={item.id}
                                key={item.href}
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                              />
                            );
                          })}
                        </VStack>
                      </VStack>
                    );
                  }

                  if (isSubNavigationOverride(item)) {
                    return item.override;
                  }

                  return (
                    <NavButton
                      id={item.id}
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                    />
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
            {baseNavBottomItems.map((item) => (
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
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <VStack gap="medium">
      <VStack gap={false}>
        <VStack borderBottom gap={false} padding="small">
          {!isMobile && (
            <NavButton
              id="settings"
              href="/settings/organization/account"
              label={t('secondaryNav.account')}
              icon={<AccountIcon />}
            />
          )}
          <AdminNav />
          <NavButton
            id="api-keys"
            href="/api-keys"
            label={t('secondaryNav.apiKeys')}
            icon={<KeyIcon />}
          />
          <NavButton
            id="select-organization"
            href="/settings/organization/members"
            label={t('secondaryNav.addMembers')}
            icon={<GroupAddIcon />}
          />
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
      <VStack className="min-w-sidebar max-w-sidebar hidden visibleSidebar:block" />
      <VStack
        overflowY="auto"
        position="fixed"
        justify="spaceBetween"
        color="background"
        fullHeight
        zIndex="rightAboveZero"
        /* eslint-disable-next-line react/forbid-component-props */
        className={`top-0 min-w-sidebar h-full max-w-sidebar invisible visibleSidebar:visible ${systemWarning ? 'system-warning-sidebar' : ''}`}
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
                  <MainNavigationItems isMobile />
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
