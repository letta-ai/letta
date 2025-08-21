import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  Button,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
  TabGroup,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { webApi } from '@letta-cloud/sdk-web';
import type { BillingTiersType } from '@letta-cloud/types';
import { PlanBenefits } from '$web/client/components/PlanBenefits/PlanBenefits';
import { Blox } from '$web/client/components/UpgradePlanDialog/Blox';
import { CreditCardSlot } from '$web/client/components';
import { useGetDefaultOrFirstCard } from '$web/client/hooks/useGetDefaultOrFirstCard/useGetDefaultOrFirstCard';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useOrganizationBillingTier } from '$web/client/hooks/useOrganizationBillingTier/useOrganizationBillingTier';
import { useCurrentUser } from '$web/client/hooks';

interface SelectedPlanProps {
  plan: BillingTiersType;
  hideBadge?: boolean;
}

function SelectedPlan(props: SelectedPlanProps) {
  const { plan, hideBadge = false } = props;

  const { formatCurrency } = useFormatters();
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const usageText = useMemo(() => {
    switch (plan) {
      case 'free':
        return t('PlanComparisonView.free.usage');
      case 'pro':
        return t('PlanComparisonView.pro.usage');
      case 'scale':
        return t('PlanComparisonView.scale.usage');
      case 'enterprise':
        return t('PlanComparisonView.enterprise.usage');
    }
  }, [plan, t]);

  const costText = useMemo(() => {
    if (plan === 'enterprise') {
      return (
        <HStack paddingBottom="small">
          <Typography overrideEl="span" variant="heading1">
            {t('PlanComparisonView.enterprise.cost')}
          </Typography>
        </HStack>
      );
    }

    const cost = getUsageLimits(plan).monthlyCost;

    return (
      <HStack gap={false} paddingBottom="small">
        <Typography color="lighter">
          {t.rich('PlanComparisonView.cost', {
            cost: () => (
              <Typography overrideEl="span" variant="heading1">
                {formatCurrency(cost, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Typography>
            ),
          })}
        </Typography>
      </HStack>
    );
  }, [formatCurrency, plan, t]);

  const label = useMemo(() => {
    switch (plan) {
      case 'free':
        return t('PlanComparisonView.free.label');
      case 'pro':
        return t('PlanComparisonView.pro.label');
      case 'scale':
        return t('PlanComparisonView.scale.label');
      case 'enterprise':
        return t('PlanComparisonView.enterprise.label');
    }
  }, [plan, t]);

  return (
    <>
      {!hideBadge && (
        <HStack>
          <Badge content={label} variant="info" border size="large" />
        </HStack>
      )}
      <HStack>{costText}</HStack>
      <Typography bold>{usageText}</Typography>
      <PlanBenefits billingTier={plan} />
    </>
  );
}

interface UpgradeToProPlanProps {
  trigger: React.ReactNode;
}

interface PlanComparisonViewProps {
  onSelectPlan: (plan: BillingTiersType) => void;
}

function PlanComparisonView(props: PlanComparisonViewProps) {
  const { onSelectPlan } = props;
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const billingTier = useOrganizationBillingTier();

  const [plan, setPlan] = useState<BillingTiersType>(() => {
    if (billingTier === 'free') {
      return 'pro';
    }

    if (billingTier === 'pro') {
      return 'scale';
    }

    return 'pro';
  });

  const items = useMemo(() => {
    return [
      {
        label: t('PlanComparisonView.free.label'),
        value: 'free',
      },
      {
        label: t('PlanComparisonView.pro.label'),
        value: 'pro',
      },
      {
        label: t('PlanComparisonView.scale.label'),
        value: 'scale',
      },
      {
        label: t('PlanComparisonView.enterprise.label'),
        value: 'enterprise',
      },
    ];
  }, [t]);

  const cta = useMemo(() => {
    switch (plan) {
      case 'free':
        return (
          <Button
            bold
            size="large"
            color="tertiary"
            label={t('PlanComparisonView.free.cta')}
            disabled
          />
        );
      case 'pro':
        return (
          <Button
            onClick={() => {
              onSelectPlan('pro');
            }}
            bold
            data-testid="choose-pro"
            size="large"
            label={t('PlanComparisonView.pro.cta')}
          />
        );
      case 'scale':
        return (
          <Button
            onClick={() => {
              onSelectPlan('scale');
            }}
            bold
            data-testid="choose-scale"
            size="large"
            label={t('PlanComparisonView.scale.cta')}
          />
        );
      case 'enterprise':
        return (
          <Button
            bold
            size="large"
            color="secondary"
            label={t('PlanComparisonView.enterprise.cta')}
            href="https://forms.letta.com/request-demo"
            target="_blank"
          />
        );
    }
  }, [plan, onSelectPlan, t]);

  return (
    <VStack gap={false} fullWidth paddingBottom>
      <HStack
        borderY
        /* eslint-disable-next-line react/forbid-component-props */
        className="h-[400px]"
        gap={false}
        justify="spaceBetween"
        color="background-grey2"
      >
        <VStack padding paddingLeft="xlarge" paddingBottom="xxlarge">
          <HStack paddingBottom="small">
            <TabGroup
              border
              color="dark"
              variant="chips"
              onValueChange={(value) => {
                setPlan(value as BillingTiersType);
              }}
              value={plan}
              items={items}
            />
          </HStack>
          <SelectedPlan hideBadge plan={plan} />
        </VStack>
        <Blox />
      </HStack>
      <VStack paddingTop="small" paddingX>
        <HStack fullWidth justify="end">
          {cta}
        </HStack>
      </VStack>
    </VStack>
  );
}

interface ConfirmViewProps {
  confirmPurchase: () => void;
  plan: BillingTiersType;
}

function ConfirmView(props: ConfirmViewProps) {
  const t = useTranslations('components/UpgradeToProPlanDialog');
  const { confirmPurchase, plan } = props;

  const defaultCard = useGetDefaultOrFirstCard();

  const cost = getUsageLimits(plan).monthlyCost;
  const { formatCurrency } = useFormatters();

  return (
    <HStack
      borderTop
      /* eslint-disable-next-line react/forbid-component-props */
      style={{ minHeight: '540px' }}
      fullHeight
      fullWidth
      gap={false}
    >
      <VStack color="background-grey2" padding fullWidth borderRight>
        <Typography uppercase bold variant="body3">
          {t('ConfirmView.title')}
        </Typography>
        <SelectedPlan plan={plan} />
      </VStack>
      <VStack fullHeight padding position="relative" fullWidth>
        <VStack>
          <VStack>
            <Typography variant="body3" bold uppercase>
              {t('confirmation.paymentMethod')}
            </Typography>
            {defaultCard && (
              <CreditCardSlot creditCard={defaultCard} disabled />
            )}
          </VStack>
          <VStack paddingBottom="small">
            <Typography variant="body2">
              {t.rich('confirmation.terms', {
                cost: formatCurrency(cost, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }),
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
          </VStack>
          <HStack paddingTop="large" paddingBottom="small">
            <Button
              color="primary"
              fullWidth
              size="large"
              data-testid="confirm-purchase"
              label={t('cta', {
                cost: formatCurrency(cost, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }),
              })}
              onClick={confirmPurchase}
            />
          </HStack>
        </VStack>
      </VStack>
    </HStack>
  );
}

export function UpgradePlanDialog(props: UpgradeToProPlanProps) {
  const { trigger } = props;
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingTiersType | null>(
    null,
  );

  const { isPending, mutate, isSuccess } =
    webApi.organizations.upgradeOrganization.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error(t('error'));
      },
    });

  const user = useCurrentUser();
  const defaultCard = useGetDefaultOrFirstCard();

  const handleSelectPlan = useCallback(
    (selectedPlan: BillingTiersType) => {
      if (defaultCard) {
        setSelectedPlan(selectedPlan);

        return;
      }

      switch (selectedPlan) {
        case 'pro':
          window.location.href = '/upgrade/pro';
          break;
        case 'scale':
          window.location.href = '/upgrade/scale';
          break;
      }
    },
    [defaultCard],
  );

  const handleSubmit = useCallback(() => {
    if (defaultCard && selectedPlan) {
      mutate({
        body: {
          cardId: defaultCard.id,
          tier: selectedPlan,
        },
      });
    }
  }, [defaultCard, mutate, selectedPlan]);

  return (
    <Dialog
      isOpen={isOpen}
      size="xlarge"
      onOpenChange={(open) => {
        if (!open) {
          setSelectedPlan(null);
        } else {
          if (user) {
            trackClientSideEvent(AnalyticsEvent.ATTEMPTED_UPGRADE, {
              user_id: user.id,
            });
          }
        }
        setIsOpen(open);
      }}
      trigger={trigger}
      title={t('title')}
      disableForm
      padding={false}
      hideFooter
    >
      {isPending || isSuccess ? (
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('purchasing')}
        />
      ) : (
        <>
          {selectedPlan ? (
            <ConfirmView
              plan={selectedPlan}
              confirmPurchase={() => {
                handleSubmit();
              }}
            />
          ) : (
            <PlanComparisonView
              onSelectPlan={(plan) => {
                handleSelectPlan(plan);

                if (user) {
                  trackClientSideEvent(AnalyticsEvent.UPGRADE_SELECTED_PLAN, {
                    plan,
                    user_id: user.id,
                  });
                }
              }}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
