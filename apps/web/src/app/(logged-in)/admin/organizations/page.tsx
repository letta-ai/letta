'use client';

import { webApi } from '$web/client';
import React, { useMemo, useState } from 'react';
import { queryClientKeys } from '$web/web-api/contracts';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type { PublicOrganizationType } from '$web/web-api/contracts';
import { useDateFormatter } from '@letta-web/helpful-client-utils';

function AdminOrganizationsPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.admin.organizations.getOrganizations.useQuery({
      queryKey: queryClientKeys.admin.organizations.getOrganizationsWithSearch({
        offset,
        limit,
        search,
      }),
      queryData: {
        query: {
          offset,
          limit,
          search,
        },
      },
    });

  const { formatDateAndTime } = useDateFormatter();

  const organizationColumns: Array<ColumnDef<PublicOrganizationType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Created at',
        accessorKey: 'createdAt',
        cell: ({ row }) => formatDateAndTime(row.original.updatedAt),
      },
      {
        header: 'Updated at',
        accessorKey: 'updatedAt',
        cell: ({ row }) => formatDateAndTime(row.original.updatedAt),
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => (
          <Button
            size="small"
            href={`/admin/organizations/${row.original.id}`}
            color="secondary"
            label="View"
          />
        ),
      },
    ],
    [formatDateAndTime],
  );

  const organizations = useMemo(() => {
    return data?.body;
  }, [data]);

  return (
    <DashboardPageLayout encapsulatedFullHeight title="Organizations">
      <DashboardPageSection fullHeight>
        <DataTable
          onLimitChange={setLimit}
          searchValue={search}
          autofitHeight
          onSearch={setSearch}
          isLoading={isFetching}
          errorMessage={isError ? 'Error fetching organizations' : undefined}
          limit={limit}
          offset={offset}
          onSetOffset={setOffset}
          showPagination
          columns={organizationColumns}
          data={organizations?.organizations || []}
          hasNextPage={organizations?.hasNextPage}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminOrganizationsPage;
