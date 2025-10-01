'use client';
import {
  ArrowUpIcon,
  DataTable,
  HStack,
  Typography,
  SideOverlay,
  SideOverlayHeader,
  VStack,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';
import type { PublicCreditTransactionType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { Slot } from '@radix-ui/react-slot';
import { Button } from '@letta-cloud/ui-component-library';
import type { Step } from '@letta-cloud/sdk-core';
import { useStepsServiceRetrieveStep } from '@letta-cloud/sdk-core';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { ModelTierBadge } from '../../../../models/_components/ModelTierBadge/ModelTierBadge';

interface InnerStepViewerProps {
  step: Step;
}

function InnerStepViewer(props: InnerStepViewerProps) {
  const { step } = props;
  const t = useTranslations('settings/audit-log');

  return (
    <VStack fullWidth fullHeight padding="small">
      <HStack padding="small" border>
        <Typography variant="body2">{step.agent_id}</Typography>
      </HStack>
      <Typography>{t('moreSoon')}</Typography>
    </VStack>
  );
}

interface StepViewerProps {
  trigger: React.ReactNode;
  stepId: string;
}

function StepViewer(props: StepViewerProps) {
  const { trigger, stepId } = props;
  const [isStepViewerOpen, setIsStepViewerOpen] = useState(false);

  const { data: step } = useStepsServiceRetrieveStep({
    stepId,
  });

  return (
    <>
      <Slot
        onClick={() => {
          setIsStepViewerOpen(true);
        }}
      >
        {trigger}
      </Slot>
      <SideOverlay
        title={stepId}
        isOpen={isStepViewerOpen}
        onOpenChange={() => {
          setIsStepViewerOpen(false);
        }}
      >
        <SideOverlayHeader>
          <Typography bold variant="body2">
            {stepId}
          </Typography>
        </SideOverlayHeader>
        <VStack collapseHeight flex overflow="auto">
          {!step ? (
            <LoadingEmptyStatusComponent isLoading />
          ) : (
            <InnerStepViewer step={step} />
          )}
        </VStack>
      </SideOverlay>
    </>
  );
}

interface AmountBadgeProps {
  amount: number;
  type: 'addition' | 'subtraction';
}

function AmountBadge(props: AmountBadgeProps) {
  const { amount, type } = props;

  const { formatCurrency } = useFormatters();

  return (
    <HStack align="center" gap="small">
      {type === 'addition' ? '+' : '-'}
      <Typography variant="body2">
        {formatCurrency(creditsToDollars(amount))}
      </Typography>
    </HStack>
  );
}

export default function TransactionEvents() {
  const t = useTranslations('settings/audit-log');
  const limit = 10;
  const [offset, setOffset] = useState(0);

  const { data, isLoading: isLoadingTransactions } =
    webApi.transactions.listTransactions.useQuery({
      queryKey: webApiQueryKeys.transactions.listTransactionsWithSearch({
        limit,
        offset,
      }),
      queryData: {
        query: {
          limit,
          offset,
        },
      },
      enabled: Boolean(limit),
    });

  const { formatDateAndTime } = useFormatters();

  const transactionColumns: Array<ColumnDef<PublicCreditTransactionType>> =
    useMemo(() => {
      return [
        {
          accessorKey: 'createdAt',
          header: t('table.columns.date'),
          cell: ({ row }) => (
            <Typography variant="body2">
              {formatDateAndTime(row.original.createdAt)}
            </Typography>
          ),
        },
        {
          accessorKey: 'amount',
          header: t('table.columns.amount'),
          cell: ({ row }) => (
            <AmountBadge
              amount={row.original.amount}
              type={row.original.type}
            />
          ),
        },
        {
          accessorKey: 'note',
          header: t('table.columns.note'),
        },
        {
          cell: ({ row }) => {
            return (
              <ModelTierBadge
                tier={row.original.modelTier || 'per-inference'}
              />
            );
          },
          accessorKey: 'modelTier',
          header: t('table.columns.modelTier'),
        },
        {
          id: 'actions',
          header: t('table.columns.actions'),
          cell: ({ row }) => {
            if (!row.original.stepId) {
              return;
            }

            return (
              <StepViewer
                stepId={row.original.stepId}
                trigger={
                  <Button
                    preIcon={<ArrowUpIcon />}
                    color="tertiary"
                    label={t('viewStep')}
                  />
                }
              />
            );
          },
        },
      ];
    }, [formatDateAndTime, t]);

  const transactionList = useMemo(() => {
    if (!data) return [];

    return data.body.transactions;
  }, [data]);

  return (
    <DataTable
      minHeight={400}
      limit={limit}
      hasNextPage={data?.body.hasNextPage}
      offset={offset}
      onSetOffset={setOffset}
      showPagination
      loadingText={t('table.loading')}
      noResultsText={t('table.noResults')}
      columns={transactionColumns}
      data={transactionList}
      isLoading={isLoadingTransactions}
    />
  );
}
