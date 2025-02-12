'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  AmexCardIcon,
  Badge,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
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
  TollIcon,
  TrashIcon,
  Typography,
  VisaCardIcon,
  VStack,
} from '@letta-cloud/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import type {
  BillingHistorySchemaType,
  contracts,
  CreditCardType,
} from '$web/web-api/contracts';
import {
  useCurrencyFormatter,
  useDateFormatter,
  useNumberFormatter,
} from '@letta-cloud/helpful-client-utils';
import { AddCreditCardDialog } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { Slot } from '@radix-ui/react-slot';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/rbac';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';
import type { ColumnDef } from '@tanstack/react-table';

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

type Tabs = 'billing-history' | 'overview' | 'payment-methods';

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
      <Section title={t('BillingOverview.Credits.title')}>
        <VStack color="background-grey" border padding>
          <VStack paddingY="small" align="start">
            <HStack align="end">
              <HStack align="center">
                <LettaCoinIcon size="large" />
                <Typography
                  variant="heading2"
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="leading-none"
                  data-testid="total-credits"
                  bold
                >
                  {formatNumber(data.body.totalCredits)}
                </Typography>
              </HStack>
              <Typography
                /* eslint-disable-next-line react/forbid-component-props */
                className="leading-none pb-[3px]"
                variant="body2"
                color="lighter"
              >
                {t('BillingOverview.Credits.available')}
              </Typography>
            </HStack>
          </VStack>
          <HStack>
            <PurchaseCreditsDialog
              trigger={
                <Button
                  preIcon={<TollIcon />}
                  label={t('BillingOverview.Credits.add')}
                  color="primary"
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

const limit = 10;

function BillingHistory() {
  const t = useTranslations('organization/billing');

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage } =
    webApi.organizations.getOrganizationBillingHistory.useInfiniteQuery({
      queryKey:
        webApiQueryKeys.organizations.getOrganizationBillingHistoryWithSearch({
          limit,
        }),
      queryData: ({ pageParam }) => ({
        query: {
          cursor: pageParam?.cursor,
          limit,
        },
      }),
      initialPageParam: { cursor: '' },
      getNextPageParam: (lastPage) => {
        if (!lastPage.body.nextCursor) {
          return undefined;
        }

        return {
          cursor: lastPage.body.nextCursor,
        };
      },
    });

  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();

  const columns: Array<ColumnDef<BillingHistorySchemaType>> = useMemo(() => {
    return [
      {
        header: t('BillingHistory.columns.date'),
        accessorKey: 'createdAt',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        header: t('BillingHistory.columns.description'),
        accessorKey: 'description',
      },
      {
        header: t('BillingHistory.columns.amount'),
        accessorKey: 'amount',
        cell: ({ row }) =>
          formatCurrency(row.original.amount, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          }),
      },
      {
        header: t('BillingHistory.columns.receipt'),
        accessorKey: 'receipt',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <Button
            label={t('BillingHistory.viewReceipt')}
            color="secondary"
            href={row.original.receiptLink}
            target="_blank"
            size="small"
          />
        ),
      },
    ];
  }, [t, formatCurrency, formatDate]);

  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const currentPage = useMemo(
    () => data?.pages[page].body.history || [],
    [data, page],
  );

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  return (
    <DataTable
      columns={columns}
      data={currentPage}
      page={page}
      onSetPage={setPage}
      loadingText={t('BillingHistory.loading')}
      noResultsText={t('BillingHistory.noBillingHistory')}
      isLoading={isLoadingPage}
      hasNextPage={hasNextPage}
      showPagination
      limit={limit}
    />
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
            variant="more-spacing"
            value={selectedTab}
            items={[
              {
                label: t('Overview.title'),
                value: 'overview',
              },
              {
                label: t('BillingHistory.title'),
                value: 'billing-history',
              },
              {
                label: t('PaymentMethods.title'),
                value: 'payment-methods',
              },
            ]}
          />
          {selectedTab === 'overview' && (
            <BillingOverview changeTab={setSelectedTab} />
          )}
          {selectedTab === 'billing-history' && <BillingHistory />}
          {selectedTab === 'payment-methods' && <PaymentMethods />}
        </DashboardPageSection>
      </VStack>
    </DashboardPageLayout>
  );
}

export default Billing;
