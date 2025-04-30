'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  LettaCoinIcon,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  Section,
  TabGroup,
  TollIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo, useState } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import type { BillingHistorySchemaType } from '$web/web-api/contracts';
import { useFeatureFlag } from '$web/web-api/contracts';
import {
  useCurrencyFormatter,
  useDateFormatter,
  useNumberFormatter,
} from '@letta-cloud/utils-client';
import { AddCreditCardDialog } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';
import type { ColumnDef } from '@tanstack/react-table';
import { CreditCardSlot } from '$web/client/components';
import type { BillingTiersType } from '@letta-cloud/types';
import { UpgradeToProPlanDialog } from '$web/client/components/UpgradeToProPlanDialog/UpgradeToProPlanDialog';
import { CancelPlanDialog } from '$web/client/components/CancelPlanDialog/CancelPlanDialog';
import { ResumePlanButton } from '$web/client/components/ResumePlanButton/ResumePlanButton';
import { CustomerQuotaView } from '$web/client/components/CustomerQuotaView/CustomerQuotaView';
import { getUsageLimits } from '@letta-cloud/utils-shared';

interface ProViewProps {
  billingPeriodEnd: string | undefined;
  isCancelled: boolean;
}

function ProView(props: ProViewProps) {
  const { billingPeriodEnd, isCancelled } = props;
  const t = useTranslations('organization/billing');
  const { formatDate } = useDateFormatter();

  if (!billingPeriodEnd) {
    return (
      <CancelPlanDialog
        trigger={
          <Button
            color="tertiary"
            bold
            size="small"
            label={t('AccountDetailsCTA.pro.cancel')}
          />
        }
      />
    );
  }

  if (isCancelled) {
    return (
      <VStack>
        <Typography>
          {t('AccountDetailsCTA.pro.cancelPeriod', {
            date: formatDate(billingPeriodEnd),
          })}
        </Typography>
        <HStack>
          <ResumePlanButton />
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack>
      <Typography>
        {t('AccountDetailsCTA.pro.billingPeriod', {
          date: formatDate(billingPeriodEnd),
        })}
      </Typography>
      <HStack>
        <CancelPlanDialog
          trigger={
            <Button
              color="tertiary"
              bold
              size="small"
              label={t('AccountDetailsCTA.pro.cancel')}
            />
          }
        />
      </HStack>
    </VStack>
  );
}

interface AccountDetailsCTAProps {
  billingTier: BillingTiersType;
  billingPeriodEnd: string | undefined;
  isCancelled: boolean;
}

function AccountDetailsCTA(props: AccountDetailsCTAProps) {
  const { billingTier, billingPeriodEnd, isCancelled } = props;

  switch (billingTier) {
    case 'free':
      return <HStack></HStack>;
    case 'pro':
      return (
        <ProView
          billingPeriodEnd={billingPeriodEnd}
          isCancelled={isCancelled}
        />
      );
  }
}

function FreePlanUpsellDetails() {
  const t = useTranslations('organization/billing');

  const limits = getUsageLimits('pro');

  const { formatNumber } = useNumberFormatter();

  return (
    <VStack border fullWidth color="brand-light" padding="xlarge">
      <HStack fullWidth align="center" justify="spaceBetween">
        <Typography variant="heading3" bold>
          {t('FreePlanUpsellDetails.title')}
        </Typography>
        <UpgradeToProPlanDialog
          trigger={
            <Button
              preIcon={<LettaInvaderIcon />}
              bold
              label={t('AccountDetailsCTA.upgrade')}
            />
          }
        />
      </HStack>
      <VStack>
        <VStack paddingY="medium">
          <Typography>{t('FreePlanUpsellDetails.description')}</Typography>
        </VStack>
        <VStack paddingLeft>
          <Typography noWrap overrideEl="li">
            {t('FreePlanUpsellDetails.features.agents', {
              agents: formatNumber(limits.agents),
            })}
          </Typography>
          <Typography noWrap overrideEl="li">
            {t('FreePlanUpsellDetails.features.premiumModels', {
              limit: formatNumber(limits.premiumInferencesPerMonth),
            })}
          </Typography>
          <Typography noWrap overrideEl="li">
            {t('FreePlanUpsellDetails.features.freeModels', {
              limit: formatNumber(limits.freeInferencesPerMonth),
            })}
          </Typography>
          <Typography noWrap overrideEl="li">
            {t('FreePlanUpsellDetails.features.free')}
          </Typography>
        </VStack>
      </VStack>
    </VStack>
  );
}

function AccountDetails() {
  const t = useTranslations('organization/billing');

  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const description = useMemo(() => {
    switch (data?.body.billingTier) {
      case 'free':
        return t('AccountDetails.description.free');
      case 'pro':
        return t('AccountDetails.description.pro');
      case 'enterprise':
        return t('AccountDetails.description.enterprise');
    }
  }, [data, t]);

  if (!data) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  if (data.body.billingTier === 'free') {
    return <FreePlanUpsellDetails />;
  }

  return (
    <Section title={t('AccountDetails.title')}>
      <Typography>{description}</Typography>
      <AccountDetailsCTA
        billingPeriodEnd={data.body.billingPeriodEnd}
        isCancelled={data.body.isCancelled}
        billingTier={data.body.billingTier}
      />
    </Section>
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

function BillingOverview() {
  const { data, isLoading, isError } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('organization/billing');

  const { data: isProPlanEnabled } = useFeatureFlag('PRO_PLAN');

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
    <VStack gap="large" width="largeContained">
      {isProPlanEnabled && <AccountDetails />}

      {data.body.billingTier !== 'enterprise' && <CustomerQuotaView />}

      <Section
        title={t('BillingOverview.Credits.title')}
        description={t('BillingOverview.Credits.description')}
      >
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
    <DashboardPageLayout cappedWidth title={t('title')}>
      <DashboardPageSection>
        <TabGroup
          color="transparent"
          extendBorder
          onValueChange={(value) => {
            setSelectedTab(value as Tabs);
          }}
          size="small"
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
        {selectedTab === 'overview' && <BillingOverview />}
        {selectedTab === 'billing-history' && <BillingHistory />}
        {selectedTab === 'payment-methods' && <PaymentMethods />}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Billing;
