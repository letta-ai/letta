import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import {
  Button,
  LettaAlienChatIcon,
  OnboardingAsideFocus,
  RocketIcon,
  ConveyorBeltIcon,
  VStack,
  WrapNotificationDot,
  MonitoringIcon,
} from '@letta-cloud/ui-component-library';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import React, { useMemo } from 'react';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { MigrationStatus } from '@letta-cloud/sdk-cloud-api';

interface SidebarButtonProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function SidebarButton(props: SidebarButtonProps) {
  const { icon, href, label } = props;
  const pathname = usePathname();

  return (
    <Button
      color="tertiary"
      href={href}
      label={label}
      preload
      active={pathname === href ? 'brand' : undefined}
      preIcon={icon}
      size="xsmall"
      hideLabel
      _use_rarely_className="hover:!bg-brand-hover hover:!text-brand-hover-content"
    />
  );
}

interface DistributionOnboardingStepProps {
  children: React.ReactNode;
}

function DistributionOnboardingStep(props: DistributionOnboardingStepProps) {
  const t = useTranslations('components/TemplateNavigationSidebar');
  const { children } = props;

  const showOnboarding = useShowOnboarding('deploy_agent');

  const pathname = usePathname();

  if (pathname.endsWith('distribution')) {
    return <>{children}</>;
  }

  if (!showOnboarding) {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      title={t('DistributionOnboardingStep.title')}
      placement="right-start"
      description={t('DistributionOnboardingStep.description')}
      isOpen
      spotlight
      totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
      currentStep={5}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function MigrationsButton() {
  const { templateName } = useCurrentAgentMetaData();

  const { slug } = useCurrentProject();

  const { data } = webApi.agentTemplates.listAgentMigrations.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.listAgentMigrationsWithSearch({
      templateName: templateName || '',
      limit: 1,
    }),
    queryData: {
      query: {
        templateName: templateName || '',
        limit: 1,
      },
    },
    refetchInterval: 5000,
    enabled: !!templateName,
  });

  const t = useTranslations('components/TemplateNavigationSidebar');

  const hasRunningMigrations = useMemo(() => {
    return data?.body.migrations[0]?.status === MigrationStatus.RUNNING;
  }, [data]);
  return (
    <SidebarButton
      label={t('nav.migrations')}
      icon={
        <WrapNotificationDot disabled={!hasRunningMigrations}>
          <ConveyorBeltIcon />
        </WrapNotificationDot>
      }
      href={`/projects/${slug}/templates/${templateName}/migrations`}
    />
  );
}

export function TemplateSidebarInner() {
  const t = useTranslations('components/TemplateNavigationSidebar');
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();

  return (
    <VStack
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[36px] min-w-[36px] pr-[1px] pt-[3px] bg-background-grey2 border border-background-grey3-border"
    >
      <SidebarButton
        icon={<LettaAlienChatIcon />}
        label={t('nav.templateEditor')}
        href={`/projects/${slug}/templates/${templateName}`}
      />
      <MigrationsButton />
      <DistributionOnboardingStep>
        <SidebarButton
          label={t('nav.distribution')}
          icon={<RocketIcon />}
          href={`/projects/${slug}/templates/${templateName}/distribution`}
        />
      </DistributionOnboardingStep>
      <SidebarButton
        icon={<MonitoringIcon />}
        label={t('nav.metrics')}
        href={`/projects/${slug}/templates/${templateName}/metrics`}
      />
    </VStack>
  );
}

export function TemplateNavigationSidebar() {
  const { isTemplate } = useCurrentAgentMetaData();

  if (!isTemplate) {
    return null;
  }

  return <TemplateSidebarInner />;
}
