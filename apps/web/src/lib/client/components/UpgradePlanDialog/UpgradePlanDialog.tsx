import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  Button,
  Dialog,
  HR,
  HStack,
  LoadingEmptyStatusComponent,
  TabGroup,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { CreditCardForm } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import type { BillingTiersType } from '@letta-cloud/types';
import { PlanBenefits } from '$web/client/components/PlanBenefits/PlanBenefits';

interface SelectedPlanProps {
  plan: BillingTiersType;
}

function SelectedPlan(props: SelectedPlanProps) {
  const { plan } = props;

  const { formatCurrency } = useFormatters();
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const usageText = useMemo(() => {
    switch (plan) {
      case 'free':
        return t('PlanComparisonView.free.usage');
      case 'pro':
        return t('PlanComparisonView.pro.usage');
      case 'enterprise':
        return t('PlanComparisonView.enterprise.usage');
    }
  }, [plan, t]);

  const costText = useMemo(() => {
    if (plan === 'enterprise') {
      return null;
    }

    const cost = plan === 'pro' ? 20 : 0;

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
      case 'enterprise':
        return t('PlanComparisonView.enterprise.label');
    }
  }, [plan, t]);

  return (
    <>
      <HStack>
        <Badge content={label} variant="info" border size="large" />
      </HStack>
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

  const [plan, setPlan] = useState<BillingTiersType>('pro');

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
            fullWidth
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
            size="large"
            fullWidth
            label={t('PlanComparisonView.pro.cta')}
          />
        );
      case 'enterprise':
        return (
          <Button
            bold
            size="large"
            color="secondary"
            fullWidth
            label={t('PlanComparisonView.enterprise.cta')}
            disabled
          />
        );
    }
  }, [plan, onSelectPlan, t]);

  return (
    <VStack paddingBottom>
      <HStack>
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
      <VStack padding color="background-grey2" border paddingBottom="xxlarge">
        <SelectedPlan plan={plan} />
        <div style={{ height: 150 }} className="h-[100px] w-full" />
      </VStack>
      <HR />
      {cta}
    </VStack>
  );
}

interface ConfirmViewProps {
  confirmPurchase: () => void;
}

function ConfirmView(props: ConfirmViewProps) {
  const t = useTranslations('components/UpgradeToProPlanDialog');
  const { confirmPurchase } = props;
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const isMissingCreditCard = useMemo(() => {
    if (!billingData) {
      return true;
    }

    return billingData.body.creditCards.length === 0;
  }, [billingData]);

  return (
    <HStack
      /* eslint-disable-next-line react/forbid-component-props */
      style={{ minHeight: '540px' }}
      paddingBottom
      gap="large"
    >
      <VStack fullWidth borderRight>
        <Typography uppercase bold variant="body3">
          {t('ConfirmView.title')}
        </Typography>
        <SelectedPlan plan="pro" />
      </VStack>
      <VStack paddingLeft="medium" position="relative" fullWidth>
        {isMissingCreditCard ? (
          <CreditCardForm label={t('cta')} onComplete={confirmPurchase} />
        ) : (
          <VStack></VStack>
        )}
      </VStack>
    </HStack>
  );
}

type Stage = 'confirm' | 'view';

export function UpgradePlanDialog(props: UpgradeToProPlanProps) {
  const { trigger } = props;
  const t = useTranslations('components/UpgradeToProPlanDialog');

  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('view');

  const { isPending, mutate, isSuccess } =
    webApi.organizations.upgradeOrganizationToPro.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error(t('error'));
      },
    });

  return (
    <Dialog
      isOpen={isOpen}
      size={stage === 'confirm' ? 'xlarge' : 'medium'}
      onOpenChange={(open) => {
        if (!open) {
          setStage('view');
        }
        setIsOpen(open);
      }}
      trigger={trigger}
      title={t('title')}
      disableForm
      hideFooter
    >
      {isPending || isSuccess ? (
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('purchasing')}
        />
      ) : (
        <>
          {stage === 'view' && (
            <PlanComparisonView
              onSelectPlan={() => {
                setStage('confirm');
              }}
            />
          )}
          {stage === 'confirm' && (
            <ConfirmView
              confirmPurchase={() => {
                mutate({});
              }}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
