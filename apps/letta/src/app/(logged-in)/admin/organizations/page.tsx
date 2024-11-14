'use client';

import { webApi } from '$letta/client';
import React, { useMemo, useState } from 'react';
import { queryClientKeys } from '$letta/web-api/contracts';
import { DashboardPageLayout, DashboardPageSection, DataTable } from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type { PublicOrganizationType } from '$letta/web-api/admin/admin-organizations/adminOrganizationsContracts';



const organizationColumns: Array<ColumnDef<PublicOrganizationType>> =  [
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: 'Created at',
    accessorKey: 'created_at',
  },
  {
    header: 'Updated at',
    accessorKey: 'updated_at',
  },
]

function AdminOrganizationsPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } = webApi.admin.organizations.getOrganizations.useQuery({
    queryKey: queryClientKeys.admin.organizations.getOrganizationsWithSearch({
      offset,
      limit,
      search
    }),
    queryData: {
      query: {
        offset,
        limit,
        search
      }
    }
  })






  const organizations = useMemo(() => {
    return data?.body;
  }, [data])


  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title="Organizations"
    >
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
          minHeight={450}
          onSetOffset={setOffset}
          showPagination
          columns={organizationColumns}
          data={organizations?.organizations || []}
          hasNextPage={organizations?.hasNextPage}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  )
}

export default AdminOrganizationsPage;
