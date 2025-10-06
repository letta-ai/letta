'use client';
import {
  DataTable,
  HStack,
  Typography,
  LettaCoinIcon, Button
} from '@letta-cloud/ui-component-library';
import type { PublicCreditTransactionType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';


interface AmountBadgeProps {
  amount: number;
  type: 'addition' | 'subtraction';
}

function AmountBadge(props: AmountBadgeProps) {
  const { amount, type } = props;

  const { formatNumber } = useFormatters();

  return (
    <HStack align="center" gap="small">
      {type === 'addition' ? '+' : '-'}
      <Typography variant="body2">
        <HStack gap="small" align="center">
          <LettaCoinIcon />{' '}
          {formatNumber(amount)}
        </HStack>
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
          meta: {
            style: {
              width: '100px',
            }
          },
          cell: ({ row }) => (
            <Typography variant="body2">
              {formatDateAndTime(row.original.createdAt)}
            </Typography>
          ),
        },
        {
          accessorKey: 'trueCost',
          meta: {
            style: {
              width: '50px',
            }
          },
          header: t('table.columns.credits'),
          cell: ({ row }) => (
            <AmountBadge
              amount={row.original.trueCost}
              type={row.original.type}
            />
          ),
        },
        {
          accessorKey: 'note',
          header: t('table.columns.note'),
        },
        {
          id: 'actions',
          meta: {
            style: {
              columnAlign: 'right'
            }
          },
          header: t('table.columns.actions'),
          cell: ({ row }) => {
            const agentId = row.original.metadata?.agentId

            if (!agentId) {
              return null;
            }

            return (
              <Button
                label={t('table.viewAgent')}
                href={`/agents/${agentId}`}
                color="secondary"
                size="small"
              />
            )

          }
        }
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
