'use client';

import { webApi } from '$web/client';
import React, { useMemo, useState } from 'react';
import { queryClientKeys } from '$web/web-api/contracts';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  ToolGroupType,
  ToolMetadataPreviewType,
} from '$web/web-api/contracts';

function ToolMetaDataTable() {
  const [offset, setOffset] = useState(0);
  const limit = 5;
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.toolMetadata.listToolMetadata.useQuery({
      queryKey: queryClientKeys.toolMetadata.listToolMetadataWithSearch({
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

  const columns: Array<ColumnDef<ToolMetadataPreviewType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Brand',
        accessorKey: 'brand',
      },
      {
        header: 'Provider',
        accessorKey: 'provider',
      },
    ],
    [],
  );

  return (
    <DataTable
      searchValue={search}
      onSearch={setSearch}
      isLoading={isFetching}
      errorMessage={isError ? 'Error fetching tools metadata' : undefined}
      limit={limit}
      offset={offset}
      onSetOffset={setOffset}
      showPagination
      columns={columns}
      data={data?.body.toolMetadata || []}
      hasNextPage={data?.body.hasNextPage}
    />
  );
}

function ToolGroupDataTable() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.toolMetadata.listToolGroupMetadata.useQuery({
      queryKey: queryClientKeys.toolMetadata.listToolGroupMetadataWithSearch({
        offset,
        limit: 5,
        search,
      }),
      queryData: {
        query: {
          offset,
          limit: 5,
          search,
        },
      },
    });

  const columns: Array<ColumnDef<ToolGroupType>> = useMemo(
    () => [
      {
        header: 'Brand',
        accessorKey: 'brand',
      },
      {
        header: 'Description',
        accessorKey: 'description',
      },
      {
        header: 'Tools',
        accessorKey: 'toolCount',
      },
    ],
    [],
  );

  return (
    <DataTable
      isLoading={isFetching}
      errorMessage={isError ? 'Error fetching tool groups metadata' : undefined}
      columns={columns}
      searchValue={search}
      onSearch={setSearch}
      data={data?.body.toolGroups || []}
      hasNextPage={data?.body.hasNextPage}
      limit={5}
      offset={offset}
      onSetOffset={setOffset}
      showPagination
    />
  );
}

function AdminToolsPage() {
  const { mutate, isPending } =
    webApi.admin.toolMetadata.syncToolsWithComposio.useMutation();

  return (
    <DashboardPageLayout encapsulatedFullHeight title="Tools">
      <DashboardPageSection title="Actions">
        <HStack>
          <Button
            onClick={() => {
              mutate(
                {},
                {
                  onSuccess: () => {
                    window.location.reload();
                  },
                },
              );
            }}
            label="Sync with Composio"
            busy={isPending}
          />
        </HStack>
      </DashboardPageSection>
      <DashboardPageSection
        title="Tool Metadata"
        description="Search and identify tool metadata"
      >
        <ToolMetaDataTable />
      </DashboardPageSection>
      <DashboardPageSection
        title="Tool Brands"
        description="All the brands that have tools"
      >
        <ToolGroupDataTable />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminToolsPage;
