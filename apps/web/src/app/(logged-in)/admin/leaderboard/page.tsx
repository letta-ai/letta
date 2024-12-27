'use client';

import { webApi, webApiQueryKeys } from '$web/client';
import React, { useMemo } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type { UsageLeaderboardType } from '$web/web-api/admin/usage/adminUsageContracts';

export default function Leaderboard() {
  const { data, isError } = webApi.admin.usage.getUsageLeaderboard.useQuery({
    queryKey: webApiQueryKeys.admin.usage.getUsageLeaderboard,
    queryData: {
      query: {},
    },
  });

  const leaderboardColumns: Array<ColumnDef<UsageLeaderboardType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Requests made',
        accessorKey: 'usage',
      },
      {
        header: 'Actions',
        accessorKey: 'id',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <Button
            size="small"
            href={`/admin/organization/${row.original.organizationId}`}
            target="_blank"
            label="View"
          />
        ),
      },
    ],
    []
  );

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title="Organization Leaderboard"
    >
      <DashboardPageSection fullHeight>
        <DataTable
          errorMessage={isError ? 'Error fetching leaderboard' : undefined}
          limit={10}
          offset={0}
          showPagination
          loadingText="Loading..."
          columns={leaderboardColumns}
          isLoading={!data}
          data={data?.body.leaderboard || []}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
