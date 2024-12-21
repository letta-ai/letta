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
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import type { AdminPublicUserType } from '$web/web-api/admin/users/adminUsersContracts';

function AdminUsersPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.admin.users.adminGetUsers.useQuery({
      queryKey: queryClientKeys.admin.users.adminGetUsersWithSearch({
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

  const organizationColumns: Array<ColumnDef<AdminPublicUserType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Email',
        accessorKey: 'email',
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
            href={`/admin/users/${row.original.id}`}
            color="secondary"
            label="View"
          />
        ),
      },
    ],
    [formatDateAndTime]
  );

  const users = useMemo(() => {
    return data?.body;
  }, [data]);

  return (
    <DashboardPageLayout encapsulatedFullHeight title="Users">
      <DashboardPageSection fullHeight>
        <DataTable
          onLimitChange={setLimit}
          searchValue={search}
          autofitHeight
          onSearch={setSearch}
          isLoading={isFetching}
          errorMessage={isError ? 'Error fetching users' : undefined}
          limit={limit}
          offset={offset}
          onSetOffset={setOffset}
          showPagination
          columns={organizationColumns}
          data={users?.users || []}
          hasNextPage={users?.hasNextPage}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminUsersPage;
