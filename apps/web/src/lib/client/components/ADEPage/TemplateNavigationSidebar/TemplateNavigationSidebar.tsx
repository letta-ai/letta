import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import {
  Button,
  LettaAlienChatIcon,
  OnboardingAsideFocus,
  RocketIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import React from 'react';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';

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
      active={pathname === href ? 'brand' : undefined}
      preIcon={icon}
      size="default"
      hideLabel
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

export function TemplateSidebarInner() {
  const t = useTranslations('components/TemplateNavigationSidebar');
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();
  return (
    <VStack
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[43px] min-w-[43px] pr-[1px] pt-[3px] bg-background-grey2"
    >
      <SidebarButton
        icon={<LettaAlienChatIcon />}
        label={t('nav.templateEditor')}
        href={`/projects/${slug}/templates/${templateName}`}
      />
      <DistributionOnboardingStep>
        <SidebarButton
          label={t('nav.distribution')}
          icon={<RocketIcon />}
          href={`/projects/${slug}/templates/${templateName}/distribution`}
        />
      </DistributionOnboardingStep>
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
