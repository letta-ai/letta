import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  Dialog,
  HStack,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { UsageLimits } from '@letta-cloud/utils-shared';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { useNumberFormatter } from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { CreditCardForm } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';

interface UpgradeToProPlanProps {
  trigger: React.ReactNode;
}

interface FeatureProps {
  type: keyof UsageLimits;
}

/*
    agents: 25,
    dataSources: 5,
    projects: 5,
    templates: 5,
    identities: 25,
    premiumInferencesPerMonth: 0,
    freeInferencesPerMonth: 100_000,
    storage: OneGB / 10, // 100 MB
 */

function Feature(props: FeatureProps) {
  const { type } = props;
  const limits = getUsageLimits('pro');
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const { formatNumber } = useNumberFormatter();

  const content = useMemo(() => {
    switch (type) {
      case 'agents':
        return t('options.agents', { amount: formatNumber(limits.agents) });
      case 'dataSources':
        return t('options.dataSources', {
          amount: formatNumber(limits.dataSources),
        });
      case 'projects':
        return t('options.projects', { amount: formatNumber(limits.projects) });
      case 'templates':
        return t('options.templates', {
          amount: formatNumber(limits.templates),
        });
      case 'identities':
        return t('options.identities', {
          amount: formatNumber(limits.identities),
        });
      case 'premiumInferencesPerMonth':
        return t('options.premiumInferencesPerMonth', {
          amount: formatNumber(limits.premiumInferencesPerMonth),
        });
      case 'freeInferencesPerMonth':
        return t('options.freeInferencesPerMonth', {
          amount: formatNumber(limits.freeInferencesPerMonth),
        });
      case 'storage': {
        // storage is in bytes
        const inGB = Math.round(limits.storage / 1073741824);

        return t('options.storage', { amount: formatNumber(inGB) });
      }
    }
  }, [
    type,
    t,
    formatNumber,
    limits.agents,
    limits.dataSources,
    limits.projects,
    limits.templates,
    limits.identities,
    limits.premiumInferencesPerMonth,
    limits.freeInferencesPerMonth,
    limits.storage,
  ]);

  return (
    <HStack padding="small" fullWidth>
      <Typography fullWidth align="center">
        {content}
      </Typography>
    </HStack>
  );
}

export function UpgradeToProPlanDialog(props: UpgradeToProPlanProps) {
  const { trigger } = props;
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const { isPending, mutate, isSuccess } =
    webApi.organizations.upgradeOrganizationToPro.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error(t('error'));
      },
    });

  const isMissingCreditCard = useMemo(() => {
    if (!billingData) {
      return true;
    }

    return billingData.body.creditCards.length === 0;
  }, [billingData]);

  const [acceptedUpgrade, setAcceptedUpgrade] = useState(false);

  return (
    <Dialog
      trigger={trigger}
      title={t('title')}
      color="background"
      disableForm
      hideFooter
    >
      {acceptedUpgrade ? (
        <CreditCardForm
          onComplete={() => {
            mutate({});
            setAcceptedUpgrade(false);
          }}
        />
      ) : (
        <>
          {isPending || isSuccess ? (
            <LoadingEmptyStatusComponent
              isLoading
              loadingMessage={t('purchasing')}
            />
          ) : (
            <VStack paddingTop paddingBottom="xxlarge" align="center">
              <LettaInvaderIcon size="xxlarge" />
              <Typography bold variant="heading1">
                {t('heading')}
              </Typography>
              <Typography bold> {t('description')}</Typography>
              <VStack paddingY fullWidth align="center">
                <Feature type="freeInferencesPerMonth" />
                <Feature type="premiumInferencesPerMonth" />
                <Feature type="agents" />
                <Feature type="identities" />
                <Feature type="storage" />
              </VStack>

              <Button
                onClick={() => {
                  if (isMissingCreditCard) {
                    setAcceptedUpgrade(true);
                    return;
                  }

                  mutate({});
                }}
                busy={isPending || isSuccess}
                fullWidth
                size="large"
                bold
                label={t('cta')}
              />
              <HStack paddingTop="small">
                <Typography color="muted" variant="body3" align="center">
                  {t.rich('legal', {
                    terms: (chunks) => (
                      <a
                        className="underline"
                        href="https://letta.com/terms-of-service"
                      >
                        {chunks}
                      </a>
                    ),
                    privacy: (chunks) => (
                      <a
                        className="underline"
                        href="https://letta.com/privacy-policy"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </Typography>
              </HStack>
            </VStack>
          )}
        </>
      )}
    </Dialog>
  );
}
