'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Button,
  ExternalLinkIcon,
  HStack,
  LettaCoinIcon,
  OnboardingAsideFocus,
  Skeleton,
  Tooltip,
  Link as StyledLink,
  Typography,
  TemplateIcon,
  VStack,
  LettaAlienChatIcon,
  ExternalLink,
  TabGroup,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';
import { useNumberFormatter } from '@letta-cloud/utils-client';
import { useCurrentUser } from '$web/client/hooks';
import { useTranslations } from '@letta-cloud/translations';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import {
  stepToRewardMap,
  TOTAL_PRIMARY_ONBOARDING_STEPS,
} from '@letta-cloud/types';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ModelPricingView } from '$web/client/components/ModelPricingView/ModelPricingView';
import { ModelPricingBlocks } from '$web/client/components/ModelPricingBlocks/ModelPricingBlocks';

type PricingModes = 'simulator' | 'table';

function PricingTable() {
  const { data: costs } = webApi.costs.getStepCosts.useQuery({
    queryKey: webApiQueryKeys.costs.getStepCosts,
  });

  if (!costs) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  return <ModelPricingBlocks costs={costs.body.stepCosts} />;
}

function PricingOverlay() {
  const t = useTranslations('components/CreditsViewer');
  const [mode, setMode] = useState<PricingModes>('simulator');

  return (
    <div className="fixed left-0 max-w-[800px] bg-white top-0 h-full w-[50%]">
      <VStack gap="xlarge" padding="xxlarge" fullHeight>
        <VStack>
          <LettaAlienChatIcon size="xxlarge" />

          <Typography variant="heading3" bold>
            {t('PricingOverlay.title')}
          </Typography>
          <Typography variant="large">
            {t('PricingOverlay.description')}
          </Typography>
        </VStack>
        <VStack fullHeight>
          <TabGroup
            border
            variant="chips"
            items={[
              {
                label: t('PricingOverlay.simulator'),
                value: 'simulator',
              },
              {
                label: t('PricingOverlay.pricingTable'),
                value: 'table',
              },
            ]}
            onValueChange={(value) => {
              setMode(value as PricingModes);
            }}
            value={mode}
            fullWidth
          />
          <VStack collapseHeight flex overflow="hidden">
            {mode === 'simulator' ? <ModelPricingView /> : <PricingTable />}
          </VStack>
        </VStack>
        <Typography variant="large">
          {t.rich('PricingOverlay.reference', {
            link: (chunks) => (
              <ExternalLink href={'/settings/organization/cost-explorer'}>
                {chunks}
              </ExternalLink>
            ),
          })}
        </Typography>
      </VStack>
    </div>
  );
}

export function CreditsViewer() {
  const user = useCurrentUser();
  const { data, isError } =
    webApi.organizations.getOrganizationCredits.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationCredits,
      enabled: user?.hasCloudAccess,
    });

  const t = useTranslations('components/CreditsViewer');

  const { formatNumber } = useNumberFormatter();

  const showOnboarding = useShowOnboarding('about_credits');

  const { setOnboardingStep } = useSetOnboardingStep();

  const handleNextStep = useCallback(() => {
    setOnboardingStep({
      onboardingStep: 'create_template',
      stepToClaim: 'about_credits',
    });

    window.location.href = '/default-project';
  }, [setOnboardingStep]);

  if (showOnboarding) {
    return (
      <OnboardingAsideFocus
        placement="bottom-end"
        reward={stepToRewardMap.about_credits}
        title={t('Onboarding.title')}
        description={t.rich('Onboarding.description', {
          link: (chunks) => (
            <StyledLink
              target="_blank"
              href="/settings/organization/costs-explorer"
            >
              <Typography variant="large" noWrap overrideEl="span">
                {chunks} <ExternalLinkIcon />
              </Typography>
            </StyledLink>
          ),
        })}
        isOpen
        totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
        currentStep={1}
        nextStep={
          <Button
            fullWidth
            preIcon={<TemplateIcon />}
            size="large"
            bold
            onClick={handleNextStep}
            label={t('Onboarding.nextStep')}
          />
        }
      >
        <PricingOverlay />
        <HStack align="center" border paddingY="xxsmall" paddingX="small">
          <LettaCoinIcon size="small" />
          <Typography variant="body3">
            {formatNumber(stepToRewardMap.about_credits)}
          </Typography>
        </HStack>
      </OnboardingAsideFocus>
    );
  }

  if (!user?.hasCloudAccess) {
    return null;
  }

  if (isError) {
    return null;
  }

  return (
    <div>
      <Tooltip asChild content={t('label')}>
        <Link href="/settings/organization/billing">
          <HStack align="center" border paddingY="xxsmall" paddingX="small">
            <LettaCoinIcon size="small" />
            {!data?.body ? (
              <Skeleton
                /* eslint-disable-next-line react/forbid-component-props */
                className="w-[65px] h-[16px]"
              />
            ) : (
              <Typography variant="body3">
                {formatNumber(data.body.credits)}
              </Typography>
            )}
          </HStack>
        </Link>
      </Tooltip>
    </div>
  );
}
