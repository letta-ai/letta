'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Badge,
  Button,
  CreditCardIcon,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  Section,
  TabGroup,
  TrashIcon,
  Typography,
  VStack,
  WalletIcon,
} from '@letta-cloud/component-library';
import React, { useCallback } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import type { contracts, CreditCardType } from '$web/web-api/contracts';
import { useNumberFormatter } from '@letta-cloud/helpful-client-utils';
import { AddCreditCardDialog } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface RemoveCreditCardDialogProps {
  paymentMethodId: string;
}

function RemoveCreditCardDialog(props: RemoveCreditCardDialogProps) {
  const { paymentMethodId } = props;
  const t = useTranslations('organization/billing');
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const { mutate, isPending } =
    webApi.organizations.removeOrganizationBillingMethod.useMutation({
      onSuccess: () => {
        setIsOpen(false);
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof contracts.organizations.getCurrentOrganizationBillingInfo,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }
            return {
              ...oldData,
              body: {
                ...oldData.body,
                creditCards: oldData.body.creditCards.filter(
                  (creditCard) => creditCard.id !== paymentMethodId,
                ),
              },
            };
          },
        );
      },
    });
  const removeCreditCard = useCallback(() => {
    mutate({
      params: {
        methodId: paymentMethodId,
      },
    });
  }, [paymentMethodId, mutate]);

  return (
    <Dialog
      title={t('RemoveCreditCardDialog.title')}
      onConfirm={removeCreditCard}
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      isConfirmBusy={isPending}
      confirmColor="destructive"
      confirmText={t('RemoveCreditCardDialog.confirm')}
      trigger={
        <Button
          preIcon={<TrashIcon />}
          label={t('RemoveCreditCardDialog.trigger')}
          hideLabel
          color="tertiary"
        />
      }
    >
      {t('RemoveCreditCardDialog.description')}
    </Dialog>
  );
}

interface CreditCardSlotProps {
  creditCard: CreditCardType;
}

function CreditCardSlot(props: CreditCardSlotProps) {
  const { id, last4, brand, isDefault, expMonth, expYear } = props.creditCard;
  const t = useTranslations('organization/billing');

  return (
    <VStack gap={false} border>
      <VStack fullWidth>
        {isDefault && (
          <Badge content={t('CreditCardSlot.default')} variant="info" />
        )}
        <HStack
          padding="small"
          borderBottom
          align="center"
          justify="spaceBetween"
        >
          <HStack align="center">
            <Badge uppercase content={brand} />
            <Typography>{t('CreditCardSlot.endingIn', { last4 })}</Typography>
          </HStack>

          <RemoveCreditCardDialog paymentMethodId={id} />
        </HStack>
      </VStack>
      <HStack padding="small" color="background-grey">
        <Typography variant="body2">
          {t('CreditCardSlot.expires', { month: expMonth, year: expYear })}
        </Typography>
      </HStack>
    </VStack>
  );
}

function PaymentMethods() {
  const { data, isLoading, isError } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('organization/billing');

  if (!data) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        errorMessage={t('BillingOverview.error')}
      />
    );
  }

  return (
    <Section
      title={t('PaymentMethods.title')}
      description={t('PaymentMethods.description')}
      actions={
        data.body.creditCards.length > 0 &&
        data.body.creditCards.length < 4 && (
          <AddCreditCardDialog
            trigger={
              <Button
                preIcon={<PlusIcon />}
                label={t('PaymentMethods.addPaymentMethod')}
                color="primary"
                size="small"
              />
            }
          />
        )
      }
    >
      <VStack position="relative">
        {data.body.creditCards.length === 0 && (
          <VStack
            padding="xxlarge"
            color="background-grey"
            fullWidth
            align="center"
          >
            <Typography>{t('PaymentMethods.noPaymentMethods')}</Typography>
            <AddCreditCardDialog
              trigger={
                <Button
                  id="add-payment-method"
                  label={t('PaymentMethods.addPaymentMethod')}
                  color="primary"
                  size="small"
                />
              }
            />
          </VStack>
        )}
        <VStack paddingY="small">
          <NiceGridDisplay itemWidth="400px">
            {data.body.creditCards.map((creditCard) => (
              <CreditCardSlot key={creditCard.id} creditCard={creditCard} />
            ))}
          </NiceGridDisplay>
        </VStack>
      </VStack>
    </Section>
  );
}

type Tabs = 'overview' | 'payment-methods';

interface BillingOverviewProps {
  changeTab: (tab: Tabs) => void;
}

function BillingOverview(props: BillingOverviewProps) {
  const { changeTab } = props;
  const { data, isLoading, isError } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('organization/billing');

  const { formatNumber } = useNumberFormatter();

  if (!data) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        errorMessage={t('BillingOverview.error')}
      />
    );
  }

  return (
    <VStack>
      {data.body.creditCards.length === 0 && (
        <Alert
          variant="warning"
          title={t('BillingOverview.noPaymentMethods')}
          action={
            <Button
              label={t('BillingOverview.addPaymentMethod')}
              color="primary"
              size="small"
              onClick={() => {
                changeTab('payment-methods');
                setTimeout(() => {
                  document.getElementById('add-payment-method')?.click();
                }, 100);
              }}
            />
          }
        />
      )}
      <Section
        title={t('BillingOverview.Credits.title')}
        description={t('BillingOverview.Credits.description')}
      >
        <VStack width="contained">
          <HStack align="end">
            <Typography variant="heading4" bold>
              {formatNumber(data.body.totalCredits)}
            </Typography>
          </HStack>
          <HStack>
            <Button
              preIcon={<PlusIcon />}
              label={t('BillingOverview.Credits.add')}
              color="primary"
              size="small"
            />
          </HStack>
        </VStack>
      </Section>
      {/*<Section*/}
      {/*  borderBottom*/}
      {/*  title={t('BillingOverview.Preferences.title')}*/}
      {/*>*/}
      {/*  <VStack>*/}
      {/*    <HStack>*/}
      {/*      <Badge variant="info" content={t('BillingOverview.Preferences.preferences.comingSoon')} />*/}
      {/*    </HStack>*/}
      {/*    <RawSwitch*/}
      {/*      disabled*/}
      {/*      description={t('BillingOverview.Preferences.preferences.autoReload.description')}*/}
      {/*      labelVariant="simple" fullWidth  label={t('BillingOverview.Preferences.preferences.autoReload.label')} />*/}
      {/*  </VStack>*/}
      {/*  <VStack>*/}
      {/*    <HStack>*/}
      {/*      <Badge variant="info" content={t('BillingOverview.Preferences.preferences.comingSoon')} />*/}
      {/*    </HStack>*/}
      {/*    <RawSwitch*/}
      {/*      disabled*/}
      {/*      description={t('BillingOverview.Preferences.preferences.emailAlert.description')}*/}
      {/*      labelVariant="simple" fullWidth  label={t('BillingOverview.Preferences.preferences.emailAlert.label')} />*/}
      {/*  </VStack>*/}
      {/*</Section>*/}
    </VStack>
  );
}

function Billing() {
  const t = useTranslations('organization/billing');
  const [selectedTab, setSelectedTab] = React.useState<Tabs>('overview');

  return (
    <DashboardPageLayout title={t('title')}>
      <VStack width="largeContained">
        <DashboardPageSection>
          <TabGroup
            extendBorder
            onValueChange={(value) => {
              setSelectedTab(value as Tabs);
            }}
            value={selectedTab}
            items={[
              {
                icon: <WalletIcon />,
                label: t('Overview.title'),
                value: 'overview',
              },
              {
                icon: <CreditCardIcon />,
                label: t('PaymentMethods.title'),
                value: 'payment-methods',
              },
            ]}
          />
          {selectedTab === 'overview' && (
            <BillingOverview changeTab={setSelectedTab} />
          )}
          {selectedTab === 'payment-methods' && <PaymentMethods />}
        </DashboardPageSection>
      </VStack>
    </DashboardPageLayout>
  );
}

export default Billing;
