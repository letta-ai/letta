'use client';
import {
  FolderIcon,
  HR,
  KeyIcon,
  ProjectsIcon,
  ToolsIcon,
  Typography,
  VStack,
  HStack,
  LoadedTypography,
  SpaceDashboardIcon,
  LettaInvaderOutlineIcon,
  TemplateIcon,
  IdentitiesIcon,
  TwoMemoryBlocksIcon,
  MonitoringIcon,
  ListIcon,
  CogIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Button,
  PlusIcon,
  McpIcon,
  BarChartIcon,
  PersonIcon,
} from '@letta-cloud/ui-component-library';
import { DashboardNavigationButton } from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigationButton/DashboardNavigationButton';
import { useTranslations } from '@letta-cloud/translations';
import React, { useMemo, useCallback } from 'react';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { SelfHostedStatusIndicator } from '$web/client/components/SelfHostedServerStatusIndicator/SelfHostedStatusIndicator';
import {
  CreateToolDialog,
  useToolManagerRouteCopy,
} from '@letta-cloud/ui-ade-components';
import { usePathname } from 'next/navigation';
import { useLastActiveProject } from './hooks/useLastActiveProject/useLastActiveProject';
import { cn } from '@letta-cloud/ui-styles';

interface NavigationMenuSection {
  children: React.ReactNode;
}

function NavigationSection(props: NavigationMenuSection) {
  return (
    <VStack as="nav" gap={false}>
      {props.children}
    </VStack>
  );
}

function Divider() {
  return (
    <HStack paddingX="large">
      <HR />
    </HStack>
  );
}

interface SectionHeaderProps {
  title?: string;
  preIcon?: React.ReactNode;
}

function SectionHeader(props: SectionHeaderProps) {
  const { title, preIcon } = props;
  const t = useTranslations('DashboardNavigation.SectionHeader');
  return (
    <HStack
      fullWidth
      overflow="hidden"
      paddingX="large"
      paddingTop="xsmall"
      align="center"
      paddingBottom="xxsmall"
    >
      {preIcon}
      {!title ? (
        <LoadedTypography fillerText={t('loading')} variant="body4" />
      ) : (
        <Typography
          fullWidth
          overflow="ellipsis"
          noWrap
          semibold
          uppercase
          variant="body4"
          color="muted"
        >
          {title}
        </Typography>
      )}
    </HStack>
  );
}

function ProjectSpecificNavigation() {
  const lastActiveProject = useLastActiveProject();

  const t = useTranslations('DashboardNavigation.ProjectSpecificNavigation');

  const [canCRDProjects] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  );

  if (!lastActiveProject) {
    return null;
  }

  const { slug, name } = lastActiveProject;

  const baseUrl = `/projects/${slug}`;

  return (
    <NavigationSection>
      <Divider />
      <SectionHeader title={name} />
      <DashboardNavigationButton
        href={`${baseUrl}`}
        id="project-dashboard"
        label={t('dashboard')}
        icon={<SpaceDashboardIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/agents`}
        id="project-agents"
        label={t('agents')}
        icon={<LettaInvaderOutlineIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/templates`}
        id="project-templates"
        label={t('templates')}
        icon={<TemplateIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/identities`}
        id="project-identities"
        label={t('identities')}
        icon={<IdentitiesIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/blocks`}
        id="project-memoryBlocks"
        label={t('memoryBlocks')}
        icon={<TwoMemoryBlocksIcon />}
      />

      <DashboardNavigationButton
        href={`${baseUrl}/observability`}
        id="project-observability"
        label={t('observability')}
        icon={<MonitoringIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/responses`}
        id="project-responses"
        label={t('responses')}
        icon={<ListIcon />}
      />
      {canCRDProjects && (
        <DashboardNavigationButton
          href={`${baseUrl}/settings`}
          id="project-settings"
          label={t('settings')}
          icon={<CogIcon />}
        />
      )}
    </NavigationSection>
  );
}

function ToolsNavigationItems() {
  const t = useTranslations('DashboardNavigation.ToolsNavigationItems');
  const copy = useToolManagerRouteCopy();
  const pathname = usePathname();

  // Track expansion state locally
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Auto-expand when on tools route, collapse when navigating away
  React.useEffect(() => {
    if (pathname.startsWith('/tools')) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [pathname]);

  const handleToolsClick = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <>
      <Divider />
      <DashboardNavigationButton
        href="javascript:void(0)"
        id="tools"
        label={t('tools')}
        postIcon={isExpanded ? <ChevronDownIcon color="muted" size="xsmall" /> : <ChevronRightIcon color="muted" size="xsmall" />}
        icon={<ToolsIcon />}
        onClick={handleToolsClick}
      />
      <div
        className={cn(
          'transition-all overflow-hidden duration-500',
          isExpanded ? 'max-h-[500px]' : 'max-h-0'
        )}
      >
        <DashboardNavigationButton
          href="/tools/custom"
          id="tools-custom"
          label={copy.customTools.title}
          icon={copy.customTools.icon}
        />
        <DashboardNavigationButton
          href="/tools/multi-agent"
          id="tools-multi-agent"
          label={copy.multiAgentTools.title}
          icon={copy.multiAgentTools.icon}
        />
        <DashboardNavigationButton
          href="/tools/utility"
          id="tools-utility"
          label={copy.utilityTools.title}
          icon={copy.utilityTools.icon}
        />
        <DashboardNavigationButton
          href="/tools/base"
          id="tools-base"
          label={copy.lettaTools.title}
          icon={copy.lettaTools.icon}
        />
        <HStack paddingX="large" paddingBottom="xsmall" paddingTop="xxsmall">
          <CreateToolDialog
            trigger={
              <Button
                align="left"
                size="xsmall"
                data-testid="start-create-tool"
                preIcon={<PlusIcon />}
                label={t('createTool')}
                color="secondary"
                bold
              />
            }
          />
        </HStack>
      </div>
      <Divider />
    </>
  );
}

/* Will always appear if user is on root */
function RootNavigationItems() {
  const t = useTranslations('DashboardNavigation.RootNavigationItems');

  const [canReadAPIKeys] = useUserHasPermission(
    ApplicationServices.READ_API_KEYS,
  );
  return (
    <NavigationSection>
      <SectionHeader title={t('all')} />
      <DashboardNavigationButton
        href="/mcp-servers"
        id="mcp-servers"
        label={t('mcp')}
        icon={<McpIcon size="small" />}
      />
      <ToolsNavigationItems />
      <DashboardNavigationButton
        href="/data-sources"
        id="filesystem"
        label={t('filesystem')}
        icon={<FolderIcon />}
      />
      {canReadAPIKeys && (
        <DashboardNavigationButton
          href="/api-keys"
          id="api-keys"
          label={t('apiKeys')}
          icon={<KeyIcon />}
        />
      )}
    </NavigationSection>
  );
}

function SelfHostedServerNavigation() {
  const t = useTranslations('DashboardNavigation.SelfHostedServerNavigation');
  const developmentServer = useCurrentDevelopmentServerConfig();

  const baseUrl = `/development-servers/${developmentServer?.id || ''}`;

  if (!developmentServer) {
    return null;
  }

  return (
    <NavigationSection>
      <SectionHeader
        preIcon={<SelfHostedStatusIndicator config={developmentServer} />}
        title={developmentServer.name}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/dashboard`}
        id="selfHostedServer-dashboard"
        label={t('dashboard')}
        icon={<SpaceDashboardIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/agents`}
        id="selfHostedServer-agents"
        label={t('agents')}
        icon={<LettaInvaderOutlineIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/identities`}
        id="selfHostedServer-identities"
        label={t('identities')}
        icon={<IdentitiesIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/blocks`}
        id="selfHostedServer-blocks"
        label={t('blocks')}
        icon={<TwoMemoryBlocksIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/tools`}
        id="selfHostedServer-tools"
        label={t('tools')}
        icon={<ToolsIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/mcp-servers`}
        id="selfHostedServer-mcpServers"
        label={t('mcpServers')}
        icon={<McpIcon />}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/settings`}
        id="selfHostedServer-settings"
        label={t('settings')}
        icon={<CogIcon />}
      />
    </NavigationSection>
  );
}

function NavigationFooter() {
  const t = useTranslations('DashboardNavigation.NavigationFooter');
  return (
    <NavigationSection>
      <DashboardNavigationButton
        href="/settings/profile"
        id="settings-profile"
        label={t('profile')}
        icon={<PersonIcon />}
      />
      <DashboardNavigationButton
        href="/settings/organization/billing"
        id="settings-billing"
        label={t('billing')}
        icon={<BarChartIcon />}
      />
      <DashboardNavigationButton
        href="/settings/organization/account"
        id="settings-profile"
        label={t('settings')}
        icon={<CogIcon />}
      />
    </NavigationSection>
  );
}

function SettingsMenu() {
  const t = useTranslations('DashboardNavigation.SettingsMenu');
  const tRoot = useTranslations('DashboardNavigation.RootNavigationItems');
  const baseUrl = '/settings';
  const lastActiveProject = useLastActiveProject();
  const developmentServer = useCurrentDevelopmentServerConfig();

  return (
    <NavigationSection>
      <DashboardNavigationButton
        href="/projects"
        id="projects"
        label={t('allProjects')}
        icon={<ProjectsIcon />}
      />
      <div
        className={cn(
          lastActiveProject || developmentServer ? 'h-[36px]' : 'h-0',
          'transition-all duration-500 overflow-hidden',
        )}
      >
        {lastActiveProject && (
          <DashboardNavigationButton
            href={`/projects/${lastActiveProject.slug}`}
            id="project-dashboard"
            label={lastActiveProject.name}
            icon={<SpaceDashboardIcon />}
          />
        )}
      </div>

      <Divider />
      <SectionHeader title={t('user')} />
      <DashboardNavigationButton
        href={`${baseUrl}/profile`}
        id="settings-profile"
        label={t('profile')}
      />

      <SectionHeader title={t('organization')} />
      <DashboardNavigationButton
        href={`${baseUrl}/organization/account`}
        id="settings-organization"
        label={t('account')}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/organization/members`}
        id="settings-members"
        label={t('members')}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/organization/billing`}
        id="settings-billing"
        label={t('billing')}
      />
      <DashboardNavigationButton
        href={`${baseUrl}/organization/models`}
        id="settings-models"
        label={tRoot('models')}
      />
      {/* Hidden for now - page still accessible via direct URL */}
      {/* <DashboardNavigationButton
        href={`${baseUrl}/organization/integrations`}
        id="settings-integrations"
        label={t('integrations')}
      /> */}
      <DashboardNavigationButton
        href={`${baseUrl}/organization/environment-variables`}
        id="settings-environmentVariables"
        label={t('environmentVariables')}
      />
    </NavigationSection>
  );
}

interface NavigationMenuProps {
  isMobile?: boolean;
}

export function NavigationMenu(props: NavigationMenuProps) {
  const { isMobile } = props;
  const t = useTranslations('DashboardNavigation');
  const lastActiveProject = useLastActiveProject();
  const developmentServer = useCurrentDevelopmentServerConfig();

  const pathname = usePathname();

  const isOnSettings = useMemo(() => {
    return pathname.startsWith('/settings') || pathname === '/settings';
  }, [pathname]);

  const developmentServerExists = useMemo(() => {
    return !!developmentServer;
  }, [developmentServer]);

  return (
    <VStack
      justify={isMobile ? 'start' : 'spaceBetween'}
      position="relative"
      fullHeight
    >
      <div
        className={cn(
          isOnSettings && !isMobile
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
          'absolute transition-opacity w-full h-full bg-background-grey duration-500',
        )}
      >
        <SettingsMenu />
      </div>
      <VStack gap={false}>
        <DashboardNavigationButton
          href={`/projects?view-mode=${developmentServerExists ? 'selfHosted' : 'cloud'}`}
          id="projects"
          label={t('allProjects')}
          icon={<ProjectsIcon />}
        />
        <div
          style={{
            height: lastActiveProject ? '290px' : '0',
          }}
          className={cn('transition-[height] overflow-hidden duration-500')}
        >
          <ProjectSpecificNavigation />
        </div>
        <Divider />
        {!developmentServerExists && <RootNavigationItems />}
        {developmentServerExists && <SelfHostedServerNavigation />}
      </VStack>
      {isMobile ? <SettingsMenu /> : <NavigationFooter />}
    </VStack>
  );
}
