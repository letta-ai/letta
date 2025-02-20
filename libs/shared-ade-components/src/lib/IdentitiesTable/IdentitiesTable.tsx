'use client';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import {
  IdentitiesService,
  useIdentitiesServiceDeleteIdentity,
} from '@letta-cloud/letta-agents-api';
import type {
  Identity,
  IdentityType,
  ListIdentitiesResponse,
} from '@letta-cloud/letta-agents-api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  HStack,
  InfoTooltip,
  Input,
  MiddleTruncate,
  TrashIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useDebouncedValue } from '@mantine/hooks';
import { UseInfiniteIdentitiesQueryFn } from './constants';
import { CreateIdentityDialog } from './CreateIdentityDialog/CreateIdentityDialog';
import { useIdentityTypeToTranslationMap } from './hooks/useIdentityTypeToTranslationMap';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface DeleteIdentityDialogProps {
  id: string;
  name: string;
  trigger: React.ReactNode;
}

function DeleteIdentityDialog(props: DeleteIdentityDialogProps) {
  const t = useTranslations('IdentitiesTable');
  const { id, name, trigger } = props;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const confirmDeleteSchema = z.object({
    name: z.literal(name, {
      message: t('DeleteIdentityDialog.confirmText.error'),
    }),
  });

  type ConfirmDeleteValues = z.infer<typeof confirmDeleteSchema>;

  const form = useForm<ConfirmDeleteValues>({
    resolver: zodResolver(confirmDeleteSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutate, isPending, isError } = useIdentitiesServiceDeleteIdentity();

  const handleSubmit = useCallback(() => {
    mutate(
      {
        identifierKey: id,
      },
      {
        onSuccess: () => {
          setOpen(false);
          queryClient.setQueriesData<
            InfiniteData<ListIdentitiesResponse> | undefined
          >(
            {
              queryKey: UseInfiniteIdentitiesQueryFn([]).slice(0, 1),
              exact: false,
            },
            (data) => {
              if (!data) {
                return data;
              }

              return {
                ...data,
                pages: data.pages.map((page) => {
                  return page.filter((identity) => identity.id !== id);
                }),
              };
            },
          );
        },
      },
    );
  }, [mutate, queryClient, id]);

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('DeleteIdentityDialog.title')}
        errorMessage={isError ? t('DeleteIdentityDialog.error') : undefined}
        isConfirmBusy={isPending}
        onOpenChange={setOpen}
        trigger={trigger}
        isOpen={open}
      >
        <VStack gap="form">
          <Alert
            variant="destructive"
            title={t('DeleteIdentityDialog.description')}
          ></Alert>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                labelVariant="simple"
                placeholder={name}
                fullWidth
                {...field}
                label={t('DeleteIdentityDialog.confirmText.label')}
              />
            )}
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface IdentityTypeCellProps {
  type: IdentityType;
}

function IdentityTypeCell(props: IdentityTypeCellProps) {
  const identityTypeToTranslationMap = useIdentityTypeToTranslationMap();

  return <Badge content={identityTypeToTranslationMap[props.type]} />;
}

interface IdentitiesTableProps {
  currentProjectId?: string;
}

export function IdentitiesTable(props: IdentitiesTableProps) {
  const { currentProjectId } = props;
  const t = useTranslations('IdentitiesTable');

  const [search, setSearch] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [limit, setLimit] = useState(0);

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery<
    ListIdentitiesResponse,
    unknown,
    InfiniteData<ListIdentitiesResponse>,
    unknown[],
    { after?: string | null }
  >({
    queryKey: UseInfiniteIdentitiesQueryFn([
      {
        name: debouncedSearch,
        limit: limit + 1,
      },
    ]),
    queryFn: ({ pageParam }) => {
      return IdentitiesService.listIdentities({
        name: debouncedSearch,
        limit: limit + 1,
        after: pageParam?.after,
        projectId: currentProjectId,
      });
    },
    initialPageParam: { after: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.length > limit) {
        return {
          after: lastPage[lastPage.length - 2].id,
        };
      }

      return undefined;
    },
    enabled: !!limit,
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const hasNextPage = useMemo(() => {
    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page, limit]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.slice(0, limit) || [];
  }, [data, page, limit]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const columns: Array<ColumnDef<Identity>> = useMemo(() => {
    return [
      {
        id: 'id',
        header: () => (
          <HStack align="center">
            {t('columns.id.label')}
            <InfoTooltip text={t('columns.id.tooltip')} />
          </HStack>
        ),
        accessorFn: (row) => row.id,
        cell: ({ row }) => {
          return (
            <HStack align="center">
              <MiddleTruncate visibleStart={4} visibleEnd={4}>
                {row.original.id || ''}
              </MiddleTruncate>
              <CopyButton
                copyButtonText={t('columns.copyId')}
                color="tertiary"
                size="small"
                hideLabel
                textToCopy={row.original.id || ''}
              />
            </HStack>
          );
        },
      },
      {
        id: 'name',
        header: t('columns.name'),
        meta: {
          style: {
            width: '50%',
          },
        },
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <HStack align="center">
            <Typography>{row.original.name}</Typography>
            <IdentityTypeCell type={row.original.identity_type} />
          </HStack>
        ),
      },
      {
        meta: {
          style: {
            width: '50%',
          },
        },
        accessorFn: (row) => row.identifier_key,
        id: 'identifierKey',
        header: () => (
          <HStack align="center">
            {t('columns.identifierKey.label')}
            <InfoTooltip text={t('columns.identifierKey.tooltip')} />
          </HStack>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          return (
            <DropdownMenu
              trigger={
                <Button
                  color="tertiary"
                  label={t('columns.actions')}
                  preIcon={<DotsHorizontalIcon />}
                  size="small"
                  hideLabel
                />
              }
              triggerAsChild
            >
              <DeleteIdentityDialog
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    label={t('DeleteIdentityDialog.trigger')}
                    preIcon={<TrashIcon />}
                  />
                }
                id={row.original.id || ''}
                name={row.original.name}
              />
            </DropdownMenu>
          );
        },
      },
    ];
  }, [t]);

  return (
    <DashboardPageLayout
      subtitle={t('description')}
      title={t('title')}
      actions={
        <CreateIdentityDialog
          currentProjectId={currentProjectId}
          trigger={<Button label={t('createIdentity')} color="primary" />}
        />
      }
      encapsulatedFullHeight
    >
      <DashboardPageSection
        fullHeight
        searchPlaceholder={t('searchInput.placeholder')}
      >
        <DataTable
          autofitHeight
          onSetPage={setPage}
          page={page}
          searchValue={search}
          errorMessage={isError ? t('table.error') : undefined}
          onSearch={!isError ? setSearch : undefined}
          onLimitChange={setLimit}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          columns={columns}
          data={filteredData}
          isLoading={isLoadingPage}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
