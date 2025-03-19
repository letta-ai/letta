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
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const { push, prefetch } = useRouter();

  const handleNextStep = useCallback(() => {
    setOnboardingStep({
      onboardingStep: 'create_template',
    });
    push('/projects/default-project');
  }, [setOnboardingStep, push]);

  useEffect(() => {
    if (showOnboarding) {
      prefetch('/projects/default-project');
    }
  }, [showOnboarding, prefetch]);

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
        difficulty="easy"
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
