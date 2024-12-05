'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import {
  Alert,
  DiscordLogoMarkDynamic,
  Form,
  FormField,
  FormProvider,
  ProjectsIcon,
  isSubNavigationGroup,
  TextArea,
  useForm,
} from '@letta-web/component-library';
import { HiddenOnMobile } from '@letta-web/component-library';
import {
  Avatar,
  Button,
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
  Popover,
  Typography,
  useDashboardNavigationItems,
  VStack,
  SwitchOrganizationIcon,
  ChevronLeftIcon,
  LaptopIcon,
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
import { LocaleSelector } from '$letta/client/components/LocaleSelector/LocaleSelector';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Sentry from '@sentry/browser';

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
        label: t('nav.dataSources'),
        href: '/data-sources',
        id: 'data-sources',
        icon: <DatabaseIcon />,
      },
      {
        label: t('nav.apiKeys'),
        href: '/api-keys',
        id: 'api-keys',
        icon: <KeyIcon />,
      },
      {
        borderTop: true,
        label: t('nav.localDev'),
        href: '/development-servers',
        id: 'development-servers',
        icon: <LaptopIcon />,
        doesNotNeedCloudAccess: true,
      },
      {
        borderTop: true,
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
            padding="small"
            borderRight={!isBaseNav}
          >
            <VStack
              fullWidth={isBaseNav}
              gap="small"
              /*eslint-disable-next-line react/forbid-component-props*/
              className="min-w-[36px]"
            >
              {baseNavItems.map((item) => {
                if (item.id === 'development-servers' && hasCloudAccess) {
                  return (
                    <VStack
                      key={item.href}
                      fullWidth
                      borderTop
                      borderBottom
                      paddingY="xsmall"
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
              <VStack gap="small">
                {subNavItems.map((item, index) => {
                  if (isSubNavigationGroup(item)) {
                    const { title, titleOverride, items: groupItems } = item;

                    return (
                      <VStack key={title} gap="small" paddingBottom="small">
                        <Frame
                          borderTop={index !== 0}
                          paddingTop={false}
                          padding="small"
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
                          {groupItems.map((item) => (
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

const reportAnIssueFormSchema = z.object({
  error: z.string(),
});

function ReportAnIssueForm() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
  );
  const [submitted, setSubmitted] = useState(false);
  const user = useCurrentUser();
  const form = useForm<z.infer<typeof reportAnIssueFormSchema>>({
    resolver: zodResolver(reportAnIssueFormSchema),
    defaultValues: {
      error: '',
    },
  });

  const handleReportIssue = useCallback(
    (values: z.infer<typeof reportAnIssueFormSchema>) => {
      Sentry.captureFeedback({
        email: user?.email,
        name: user?.name,
        message: values.error,
      });

      setSubmitted(true);
    },
    [user?.email, user?.name]
  );

  if (submitted) {
    return (
      <Alert variant="info" title={t('ReportAnIssueForm.submitted')}></Alert>
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleReportIssue)}>
        <VStack gap="form">
          <FormField
            name="error"
            render={({ field }) => (
              <TextArea
                fullWidth
                hideLabel
                label={t('ReportAnIssueForm.yourMessage')}
                {...field}
              />
            )}
          />
          <Button
            fullWidth
            type="submit"
            label={t('ReportAnIssueForm.submit')}
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

interface DashboardHeaderNavigationProps {
  preItems?: React.ReactNode;
}

export function DashboardHeaderNavigation(
  props: DashboardHeaderNavigationProps
) {
  const { preItems } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation'
  );

  return (
    <HiddenOnMobile>
      <HStack gap="small" align="center">
        {preItems}
        <Button
          size="small"
          color="tertiary-transparent"
          target="_blank"
          label={t('DashboardHeaderNavigation.documentation')}
          href="https://docs.letta.com/introduction"
        />
        <Button
          size="small"
          color="tertiary-transparent"
          target="_blank"
          label={t('DashboardHeaderNavigation.apiReference')}
          href="https://docs.letta.com/api-reference"
        />
        <Popover
          triggerAsChild
          trigger={
            <Button
              size="small"
              color="tertiary-transparent"
              label={t('DashboardHeaderNavigation.support')}
            />
          }
        >
          <VStack borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.bugReport.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.bugReport.description'
              )}
            </Typography>
            <ReportAnIssueForm />
          </VStack>
          <VStack borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.discord.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.discord.description'
              )}
            </Typography>
            <a
              target="_blank"
              className="px-3 flex justify-center items-center gap-2 py-2 text-white bg-[#7289da]"
              href="https://discord.gg/letta"
            >
              {/* eslint-disable-next-line react/forbid-component-props */}
              <DiscordLogoMarkDynamic size="small" />
              <Typography bold>
                {t('DashboardHeaderNavigation.supportPopover.discord.joinUs')}
              </Typography>
            </a>
          </VStack>
        </Popover>
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
              <HStack justify="start" align="center">
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

                  <HiddenOnMobile>
                    {currentProject.id && (
                      <>
                        <HStack paddingLeft="small">/</HStack>
                        <ProjectSelector />
                      </>
                    )}
                  </HiddenOnMobile>
                </>
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
