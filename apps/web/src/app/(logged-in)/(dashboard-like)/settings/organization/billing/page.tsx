'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  AmexCardIcon,
  Badge,
  Button,
  CreditCardIcon,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  DiscoverCardIcon,
  HStack,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  MastercardCardIcon,
  NiceGridDisplay,
  PlusIcon,
  Section,
  StripeCardIcon,
  TabGroup,
  TrashIcon,
  Typography,
  VisaCardIcon,
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
import { Slot } from '@radix-ui/react-slot';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/rbac';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';

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

interface CreditCardOverrideIconProps {
  brand: string;
}

function CreditCardOverrideIcon(props: CreditCardOverrideIconProps) {
  const { brand } = props;

  const icon = (() => {
    if (brand === 'visa') {
      return <VisaCardIcon />;
    }

    if (brand === 'mastercard') {
      return <MastercardCardIcon />;
    }

    if (brand === 'amex') {
      return <AmexCardIcon />;
    }

    if (brand === 'discover') {
      return <DiscoverCardIcon />;
    }

    return <StripeCardIcon />;
  })();

  return (
    <Slot
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[48px] w-auto"
    >
      {icon}
    </Slot>
  );
}

interface SetDefaultCreditCardDialogProps {
  paymentMethodId: string;
}

function SetDefaultCreditCardDialog(props: SetDefaultCreditCardDialogProps) {
  const { paymentMethodId } = props;

  const t = useTranslations('organization/billing');

  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const { mutate, isError, isPending } =
    webApi.organizations.setDefaultOrganizationBillingMethod.useMutation({
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
                creditCards: oldData.body.creditCards.map((creditCard) => ({
                  ...creditCard,
                  isDefault: creditCard.id === paymentMethodId,
                })),
              },
            };
          },
        );
      },
    });

  const handleSetDefault = useCallback(() => {
    mutate({
      params: {
        methodId: paymentMethodId,
      },
    });
  }, [paymentMethodId, mutate]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      errorMessage={isError ? t('SetDefaultCreditCardDialog.error') : undefined}
      title={t('SetDefaultCreditCardDialog.title')}
      onConfirm={handleSetDefault}
      isConfirmBusy={isPending}
      confirmText={t('SetDefaultCreditCardDialog.confirm')}
      trigger={
        <Button
          size="xsmall"
          label={t('SetDefaultCreditCardDialog.trigger')}
          color="tertiary"
        />
      }
    >
      {t('SetDefaultCreditCardDialog.description')}
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
        <HStack padding="small" align="center" justify="spaceBetween">
          <HStack align="center">
            <CreditCardOverrideIcon brand={brand} />

            <VStack gap={false} align="start">
              <Typography align="left">
                {t('CreditCardSlot.endingIn', { last4 })}
              </Typography>
              <Typography align="left" variant="body2">
                {t('CreditCardSlot.expires', {
                  month: expMonth,
                  year: expYear,
                })}
              </Typography>
            </VStack>
          </HStack>
          <HStack align="center">
            {isDefault ? (
              <Badge content={t('CreditCardSlot.default')} variant="info" />
            ) : (
              <HStack align="center">
                <SetDefaultCreditCardDialog paymentMethodId={id} />
                <RemoveCreditCardDialog paymentMethodId={id} />
              </HStack>
            )}
          </HStack>
        </HStack>
      </VStack>
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
    <VStack width="contained">
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
        <VStack>
          <VStack paddingY="small" align="start">
            <HStack align="center">
              <LettaCoinIcon size="large" />
              <Typography
                variant="heading2"
                /* eslint-disable-next-line react/forbid-component-props */
                className="leading-none"
                bold
              >
                {formatNumber(data.body.totalCredits)}
              </Typography>
            </HStack>
            <Typography
              /* eslint-disable-next-line react/forbid-component-props */
              className="leading-none"
              variant="body2"
              color="lighter"
            >
              {t('BillingOverview.Credits.available')}
            </Typography>
          </VStack>
          <HStack>
            <PurchaseCreditsDialog
              trigger={
                <Button
                  preIcon={<PlusIcon />}
                  label={t('BillingOverview.Credits.add')}
                  color="primary"
                  size="small"
                />
              }
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

  const [canManageBilling] = useUserHasPermission(
    ApplicationServices.MANAGE_BILLING,
  );

  if (!canManageBilling) {
    return <Alert title={t('noPermission')} variant="destructive" />;
  }

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
