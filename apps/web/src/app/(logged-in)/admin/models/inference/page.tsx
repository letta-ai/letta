'use client';

import { webApi } from '$web/client';
import React, { useMemo, useState } from 'react';
import type { contracts } from '$web/web-api/contracts';
import { queryClientKeys } from '$web/web-api/contracts';
import type { DialogTableItem } from '@letta-web/component-library';
import {
  brandKeyToLogo,
  brandKeyToName,
  Button,
  CheckIcon,
  CloseIcon,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DialogTable,
  HStack,
  IconWrapper,
  isBrandKey,
  Typography,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import type { AdminInferenceModelType } from '$web/web-api/contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface ImportModelActionProps {
  modelName: string;
  modelEndpoint: string;
}

function ImportModelAction(props: ImportModelActionProps) {
  const { modelName, modelEndpoint } = props;
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.admin.models.createAdminInferenceModel.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof contracts.admin.models.getAdminInferenceModels,
            200
          >
        >(
          {
            queryKey:
              queryClientKeys.admin.models.getAdminInferenceModelsWithSearch({
                offset: 0,
                limit: 1,
                search: '',
                modelEndpoint,
                modelName,
              }),
          },
          () => {
            return {
              status: 200,
              body: {
                inferenceModels: [response.body],
                hasNextPage: false,
              },
            };
          },
        );

        queryClient.setQueriesData<
          | ServerInferResponses<
              typeof contracts.admin.models.getAdminInferenceModels,
              200
            >
          | undefined
        >(
          {
            queryKey:
              queryClientKeys.admin.models.getAdminInferenceModelsWithSearch({
                offset: 0,
                limit: 10,
                search: '',
              }),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                inferenceModels: [
                  response.body,
                  ...oldData.body.inferenceModels,
                ],
              },
            };
          },
        );
      },
    });
  const { data: existingAdmin, isLoading } =
    webApi.admin.models.getAdminInferenceModels.useQuery({
      queryKey: queryClientKeys.admin.models.getAdminInferenceModelsWithSearch({
        offset: 0,
        limit: 1,
        search: '',
        modelEndpoint,
        modelName,
      }),
      queryData: {
        query: {
          offset: 0,
          limit: 1,
          search: '',
          modelEndpoint,
          modelName,
        },
      },
    });

  if (existingAdmin?.body.inferenceModels.length === 1) {
    return (
      <Button
        color="secondary"
        size="small"
        disabled
        label="Already imported"
      />
    );
  }

  return (
    <Button
      size="small"
      color="secondary"
      label="Import"
      disabled={isLoading}
      onClick={() => {
        mutate({
          body: {
            modelName,
            modelEndpoint,
          },
        });
      }}
      busy={isPending}
    />
  );
}

function ImportModelsDialog() {
  const { data: modelsList } =
    webApi.admin.models.getAdminInferenceModels.useQuery({
      queryKey: queryClientKeys.admin.models.getAdminInferenceModelsWithSearch({
        fromAgents: true,
      }),
      queryData: {
        query: {
          fromAgents: true,
        },
      },
    });

  const items: DialogTableItem[] = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList.body.inferenceModels.map(({ config }) => {
      if (!config) {
        return {
          label: 'Unknown model',
          action: <Button label="Import" disabled />,
        };
      }

      return {
        icon: isBrandKey(config.model_endpoint_type)
          ? brandKeyToLogo(config.model_endpoint_type)
          : null,
        label: config.model,
        action: (
          <ImportModelAction
            modelName={config.model}
            modelEndpoint={config.model_endpoint || ''}
          />
        ),
      };
    });
  }, [modelsList]);

  return (
    <Dialog
      disableForm
      hideConfirm
      trigger={<Button label="Import Models" />}
      title="Import Inference Model"
    >
      <Typography>
        You can import models into cloud here given what Letta Agents is
        providing.
      </Typography>
      <DialogTable items={items} emptyMessage="No models available" />
    </Dialog>
  );
}

function AdminInferenceModelsPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.admin.models.getAdminInferenceModels.useQuery({
      queryKey: queryClientKeys.admin.models.getAdminInferenceModelsWithSearch({
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

  const inferenceModelsColumns: Array<ColumnDef<AdminInferenceModelType>> =
    useMemo(
      () => [
        {
          header: 'Name',
          accessorKey: 'name',
        },
        {
          header: 'Brand',
          accessorKey: 'brand',
          cell: ({ row }) => {
            if (isBrandKey(row.original.brand)) {
              return (
                <HStack align="center">
                  <IconWrapper>
                    {brandKeyToLogo(row.original.brand)}
                  </IconWrapper>
                  {brandKeyToName(row.original.brand)}
                </HStack>
              );
            }

            return `Unknown brand: ${row.original.brand}`;
          },
        },
        {
          header: 'Created at',
          accessorKey: 'createdAt',
          cell: ({ row }) => formatDateAndTime(row.original.updatedAt),
        },
        {
          header: 'Visible to users',
          accessorKey: 'disabledAt',
          cell: ({ row }) =>
            row.original.disabledAt ? <CloseIcon /> : <CheckIcon />,
        },
        {
          header: 'Actions',
          id: 'actions',
          cell: ({ row }) => (
            <Button
              size="small"
              href={`/admin/models/inference/${row.original.id}`}
              color="secondary"
              label="View"
            />
          ),
        },
      ],
      [formatDateAndTime],
    );

  const inferenceModels = useMemo(() => {
    return data?.body;
  }, [data]);

  return (
    <DashboardPageLayout
      actions={<ImportModelsDialog />}
      encapsulatedFullHeight
      title="Inference Models"
    >
      <DashboardPageSection fullHeight>
        <DataTable
          onLimitChange={setLimit}
          searchValue={search}
          autofitHeight
          onSearch={setSearch}
          isLoading={isFetching}
          errorMessage={isError ? 'Error fetching inference models' : undefined}
          limit={limit}
          offset={offset}
          onSetOffset={setOffset}
          showPagination
          columns={inferenceModelsColumns}
          data={inferenceModels?.inferenceModels || []}
          hasNextPage={inferenceModels?.hasNextPage}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminInferenceModelsPage;
