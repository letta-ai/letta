'use client';
import type { Violation } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import {
  Button,
  DashboardPageLayout,
  DataTable,
  Dialog,
  HStack,
  Typography,
} from '@letta-cloud/ui-component-library';

export default function ContentViolationsPage() {
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);
  const { data, isLoading } =
    webApi.admin.contentViolations.adminGetContentViolations.useQuery({
      queryData: {
        query: {
          limit,
          offset,
        },
      },
      queryKey:
        webApiQueryKeys.admin.contentViolations.adminGetContentViolations(
          limit,
          offset,
        ),
      enabled: limit > 0,
    });

  const columns: Array<ColumnDef<Violation>> = useMemo(
    () => [
      {
        accessorKey: 'flaggedAt',
        header: 'Flagged at',
      },

      {
        accessorKey: 'reasons',
        header: 'Reasons',
        cell: ({ row }) => {
          const reasons = row.original.reasons;

          if (reasons.length > 3) {
            return (
              <HStack align="center">
                <Typography>{reasons.slice(0, 3).join(',')}...</Typography>
                <Dialog
                  trigger={<Button size="small" label="All" />}
                  title="Reasons"
                >
                  {reasons.map((reason) => (
                    <Typography key={reason}>{reason}</Typography>
                  ))}
                </Dialog>
              </HStack>
            );
          }

          return <Typography>{row.original.reasons.join(',')}</Typography>;
        },
      },
      {
        accessorKey: 'organizationId',
        header: 'Organization',
        cell: ({ row }) => {
          return (
            <HStack align="center">
              <Typography>{row.original.organizationName}</Typography>
              <Button
                size="small"
                href={`/admin/organizations/${row.original.organizationId}`}
                label="View"
              />
            </HStack>
          );
        },
      },

      {
        accessorKey: 'content',
        header: 'Content',
        cell: ({ row }) => {
          return (
            <Dialog
              trigger={<Button size="small" label="View Content"></Button>}
              title="Content"
            >
              {row.original.content}
            </Dialog>
          );
        },
      },
    ],
    [],
  );

  return (
    <DashboardPageLayout encapsulatedFullHeight title="Content Violations">
      <DataTable
        autofitHeight
        columns={columns}
        showPagination
        data={data?.body.violations || []}
        isLoading={isLoading}
        hasNextPage={data?.body.hasNextPage}
        onLimitChange={setLimit}
        limit={limit}
        offset={offset}
        onSetOffset={setOffset}
      />
    </DashboardPageLayout>
  );
}
