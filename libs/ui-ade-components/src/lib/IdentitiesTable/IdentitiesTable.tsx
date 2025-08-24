'use client';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import {
  IdentitiesService,
  isAPIError,
  useIdentitiesServiceDeleteIdentity,
  useIdentitiesServiceUpdateIdentity,
  useIdentitiesServiceUpsertIdentityProperties,
} from '@letta-cloud/sdk-core';
import type {
  Identity,
  IdentityType,
  ListIdentitiesResponse,
} from '@letta-cloud/sdk-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  DesktopPageLayout,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  Form,
  FormField,
  FormProvider,
  HR,
  HStack,
  IdentitiesIcon,
  InfoTooltip,
  Input,
  isMultiValue,
  KeyValueEditor,
  MiddleTruncate,
  PlusIcon,
  Select,
  SideOverlay,
  SideOverlayHeader,
  TrashIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useDebouncedValue } from '@mantine/hooks';
import { UseInfiniteIdentitiesQueryFn } from './constants';
import { CreateIdentityDialog } from './CreateIdentityDialog/CreateIdentityDialog';
import { useIdentityTypeToTranslationMap } from './hooks/useIdentityTypeToTranslationMap';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIdentityOptions } from './hooks/useIdentityOptions/useIdentityOptions';
import { IdentityAgentsList } from './IdentityAgentsList/IdentityAgentsList';

interface DeleteIdentityDialogProps {
  id: string;
  name: string;
  trigger: React.ReactNode;
  onDelete?: VoidFunction;
}

function DeleteIdentityDialog(props: DeleteIdentityDialogProps) {
  const t = useTranslations('IdentitiesTable');
  const { id, onDelete, name, trigger } = props;
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
        identityId: id,
      },
      {
        onSuccess: () => {
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

          setOpen(false);

          if (onDelete) {
            onDelete();
          }
        },
      },
    );
  }, [mutate, queryClient, id, onDelete]);

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

interface IdentityItemOverlayProps {
  identity: Identity;
  currentProjectId?: string;
}

const basicDetailsFormSchema = z.object({
  name: z.string(),
  identifierKey: z.string(),
  identityType: z.enum(['org', 'user', 'other']),
  properties: z
    .object({
      key: z.string(),
      value: z.string(),
      type: z.union([
        z.literal('string'),
        z.literal('number'),
        z.literal('boolean'),
        z.literal('json'),
      ]),
    })
    .array(),
});

type BasicDetailsFormValues = z.infer<typeof basicDetailsFormSchema>;

interface BasicDetailsEditorProps {
  identity: Identity;
}

function BasicDetailsEditor(props: BasicDetailsEditorProps) {
  const t = useTranslations('IdentitiesTable');
  const { identityTypeOptions, getOptionFromValue } = useIdentityOptions();

  const { identity } = props;

  const {
    mutate: updateIdentity,
    reset: resetUpdateIdentity,
    isPending: isUpdateIdentityUpdating,
    error: updateIdentityError,
  } = useIdentitiesServiceUpdateIdentity();

  const {
    mutate: updateIdentityProperties,
    reset: resetUpdateIdentityProperties,
    isPending: isUpdateIdentityPropertiesUpdating,
    error: updateIdentityPropertiesError,
  } = useIdentitiesServiceUpsertIdentityProperties();

  const queryClient = useQueryClient();
  const form = useForm<BasicDetailsFormValues>({
    resolver: zodResolver(basicDetailsFormSchema),
    defaultValues: {
      name: identity.name,
      identifierKey: identity.identifier_key,
      identityType: identity.identity_type,
      properties:
        (identity.properties || []).map((property) => ({
          key: property.key,
          value:
            typeof property.value === 'string'
              ? property.value
              : JSON.stringify(property.value),
          type: property.type,
        })) || [],
    },
  });

  const isPending = useMemo(() => {
    return isUpdateIdentityPropertiesUpdating || isUpdateIdentityUpdating;
  }, [isUpdateIdentityPropertiesUpdating, isUpdateIdentityUpdating]);

  const error = useMemo(() => {
    if (updateIdentityPropertiesError) {
      return updateIdentityPropertiesError;
    }

    if (updateIdentityError) {
      return updateIdentityError;
    }

    return null;
  }, [updateIdentityPropertiesError, updateIdentityError]);

  const handleSubmit = useCallback(
    (values: BasicDetailsFormValues) => {
      // check for duplicate keys
      const keys = values.properties.map((property) => property.key);
      const uniqueKeys = new Set(keys);

      if (uniqueKeys.size !== keys.length) {
        form.setError('properties', {
          type: 'custom',
          message: t('BasicDetailsEditor.properties.errors.duplicateKeys'),
        });
        return;
      }

      updateIdentityProperties(
        {
          identityId: identity.id || '',
          requestBody: values.properties.map((property) => ({
            key: property.key.trim(),
            value: property.value.trim(),
            type: property.type,
          })),
        },
        {
          onSuccess: () => {
            updateIdentity(
              {
                identityId: identity.id || '',
                requestBody: {
                  identifier_key: values.identifierKey.trim(),
                  identity_type: values.identityType,
                  name: values.name.trim(),
                },
              },
              {
                onSuccess: () => {
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
                          return page.map((ide) => {
                            if (ide.id === identity.id) {
                              return {
                                ...identity,
                                ...values,
                              };
                            }

                            return ide;
                          });
                        }),
                      };
                    },
                  );

                  form.reset({
                    name: values.name,
                    identifierKey: values.identifierKey,
                    identityType: values.identityType,
                    properties: values.properties,
                  });
                  resetUpdateIdentity();
                  resetUpdateIdentityProperties();
                },
              },
            );
          },
        },
      );
    },
    [
      updateIdentityProperties,
      identity,
      updateIdentity,
      form,
      t,
      queryClient,
      resetUpdateIdentity,
      resetUpdateIdentityProperties,
    ],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body?.detail?.includes('unique constraint')) {
          return t('BasicDetailsEditor.errors.uniqueConstraint');
        }
      }

      return t('BasicDetailsEditor.errors.default');
    }

    return '';
  }, [error, t]);

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack padding gap="form">
          {errorMessage && <Alert title={errorMessage} variant="destructive" />}
          <Typography variant="heading6" bold>
            {t('BasicDetailsEditor.title')}
          </Typography>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                label={t('BasicDetailsEditor.name.label')}
                fullWidth
                {...field}
              />
            )}
          />
          <FormField
            name="identifierKey"
            render={({ field }) => (
              <Input
                label={t('BasicDetailsEditor.identifierKey.label')}
                fullWidth
                {...field}
              />
            )}
          />
          <FormField
            name="identityType"
            render={({ field }) => (
              <Select
                fullWidth
                onSelect={(value) => {
                  if (isMultiValue(value) || !value) {
                    return;
                  }

                  field.onChange(value?.value);
                }}
                value={getOptionFromValue(field.value)}
                label={t('BasicDetailsEditor.identityType.label')}
                options={identityTypeOptions}
              />
            )}
          />
          <HR />
          <FormField
            render={({ field }) => (
              <KeyValueEditor
                fullWidth
                highlightDuplicateKeys
                infoTooltip={{
                  text: t('BasicDetailsEditor.properties.tooltip'),
                }}
                onValueChange={(value) => {
                  field.onChange(
                    value.map((property) => ({ ...property, type: 'string' })),
                  );
                }}
                label={t('BasicDetailsEditor.properties.label')}
                value={field.value}
              />
            )}
            name="properties"
          />
          <HR />
          <HStack fullWidth justify="spaceBetween">
            <div />
            <HStack>
              {form.formState.isDirty && (
                <Button
                  label={t('BasicDetailsEditor.reset')}
                  color="tertiary"
                  type="button"
                  onClick={() => {
                    form.reset();
                  }}
                />
              )}
              <Button
                busy={isPending}
                disabled={!form.formState.isDirty}
                label={t('BasicDetailsEditor.save')}
                color="primary"
              />
            </HStack>
          </HStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function IdentityItemOverlay(props: IdentityItemOverlayProps) {
  const { identity, currentProjectId } = props;
  const t = useTranslations('IdentitiesTable');
  const [open, setOpen] = useState(false);

  return (
    <SideOverlay
      isOpen={open}
      onOpenChange={setOpen}
      title={t('IdentityItemOverlay.title')}
      trigger={
        <Button
          label={t('IdentityItemOverlay.trigger')}
          color="tertiary"
          size="small"
        />
      }
    >
      <VStack overflow="hidden" gap={false}>
        <SideOverlayHeader>
          <Breadcrumb
            size="small"
            items={[
              {
                label: t('IdentityItemOverlay.breadcrumb.main'),
                onClick: () => {
                  setOpen(false);
                },
              },
              {
                label: identity.name,
              },
            ]}
          />
        </SideOverlayHeader>
        <VStack flex collapseHeight overflowY="auto">
          <BasicDetailsEditor identity={identity} />
          <VStack paddingX>
            <Typography variant="heading6" bold>
              {t('IdentityItemOverlay.agents')}
            </Typography>
            <IdentityAgentsList
              currentProjectId={currentProjectId}
              identity={identity}
            />
          </VStack>
          <VStack paddingX>
            <Typography variant="heading6" bold>
              {t('IdentityItemOverlay.advanced')}
            </Typography>
            <VStack paddingBottom>
              <Typography>
                {t('IdentityItemOverlay.deleteIdentityInfo')}
              </Typography>
              <HStack>
                <DeleteIdentityDialog
                  id={props.identity.id || ''}
                  name={props.identity.name}
                  onDelete={() => {
                    setOpen(false);
                  }}
                  trigger={
                    <Button
                      type="button"
                      label={t('BasicDetailsEditor.delete')}
                      color="secondary"
                      preIcon={<TrashIcon />}
                    />
                  }
                />
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </VStack>
    </SideOverlay>
  );
}

interface IdentitiesTableProps {
  currentProjectId?: string;
  isDesktop?: boolean;
}

export function IdentitiesTable(props: IdentitiesTableProps) {
  const { currentProjectId, isDesktop } = props;
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
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
        limit: limit + 1,
      },
    ]),
    queryFn: ({ pageParam }) => {
      return IdentitiesService.listIdentities({
        name: debouncedSearch,
        limit: limit + 1,
        after: pageParam?.after,
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
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
            <HStack>
              <IdentityItemOverlay
                currentProjectId={currentProjectId}
                identity={row.original}
              />
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
            </HStack>
          );
        },
      },
    ];
  }, [t, currentProjectId]);

  const table = (
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
  );

  if (isDesktop) {
    return (
      <DesktopPageLayout
        icon={<IdentitiesIcon />}
        subtitle={t('description')}
        title={t('title')}
        actions={
          <CreateIdentityDialog
            currentProjectId={currentProjectId}
            trigger={
              <Button
                data-testid="start-create-identity"
                preIcon={<PlusIcon />}
                label={t('createIdentity')}
                color="primary"
              />
            }
          />
        }
      >
        <VStack fullWidth fullHeight paddingX="small" paddingTop="small">
          {table}
        </VStack>
      </DesktopPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      subtitle={t('description')}
      title={t('title')}
      actions={
        <CreateIdentityDialog
          currentProjectId={currentProjectId}
          trigger={
            <Button
              data-testid="start-create-identity"
              preIcon={<PlusIcon />}
              label={t('createIdentity')}
              color="primary"
            />
          }
        />
      }
      encapsulatedFullHeight
    >
      <DashboardPageSection
        fullHeight
        searchPlaceholder={t('searchInput.placeholder')}
      >
        {table}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
