'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  NiceGridDisplay,
  PlusIcon,
  TextArea,
  Tooltip,
  Typography,
  useForm,
  VStack,
  BillingLink,
  Badge,
  DropdownMenu,
  DropdownMenuItem,
  CaretUpIcon,
  CaretDownIcon,
} from '@letta-cloud/ui-component-library';
import { isAPIError, type Source } from '@letta-cloud/sdk-core';
import {
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
  useSourcesServiceGetAgentsForSource,
} from '@letta-cloud/sdk-core';
import { useSourcesServiceListSources } from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useFormatters } from '@letta-cloud/utils-client';
import { useDebouncedValue } from '@mantine/hooks';
import Link from 'next/link';

const createDataSourceSchema = z.object({
  name: z.string().min(3),
  instructions: z.string(),
});

type CreateDataSourceSchemaType = z.infer<typeof createDataSourceSchema>;

function CreateDataSourceDialog() {
  const { push } = useRouter();
  const t = useTranslations('data-sources/page');

  const queryClient = useQueryClient();
  const { mutate, isPending, isSuccess, error } = useSourcesServiceCreateSource(
    {
      onSuccess: (response) => {
        void queryClient.invalidateQueries({
          queryKey: UseSourcesServiceListSourcesKeyFn(),
        });

        push(`/data-sources/${response.id}`);
      },
    },
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error) && error.status === 402) {
        return t.rich('CreateDataSourceDialog.errors.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }

      return t('CreateDataSourceDialog.errors.default');
    }

    return undefined;
  }, [error, t]);

  const form = useForm<CreateDataSourceSchemaType>({
    resolver: zodResolver(createDataSourceSchema),
    defaultValues: {
      name: '',
      instructions: '',
    },
  });

  const handleSubmit = useCallback(
    (values: CreateDataSourceSchemaType) => {
      mutate({
        requestBody: {
          name: values.name,
          instructions: values.instructions,
        },
      });
    },
    [mutate],
  );

  const [canCreateDataSource] = useUserHasPermission(
    ApplicationServices.CREATE_DATA_SOURCE,
  );

  if (!canCreateDataSource) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('CreateDataSourceDialog.title')}
        confirmText={t('CreateDataSourceDialog.createButton')}
        isConfirmBusy={isPending || isSuccess}
        errorMessage={errorMessage}
        trigger={
          <Button
            preIcon={<PlusIcon />}
            label={t('CreateDataSourceDialog.trigger')}
          />
        }
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('CreateDataSourceDialog.name.label')}
              {...field}
            />
          )}
        />
        <FormField
          name="instructions"
          render={({ field }) => (
            <TextArea
              fullWidth
              label={t('CreateDataSourceDialog.instructions.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

interface DataSourcesListProps {
  search: string;
}

interface DataSourceCardProps {
  dataSource: Source;
}

function DataSourceCard(props: DataSourceCardProps) {
  const { dataSource } = props;
  const t = useTranslations('data-sources/page');
  const { formatDateAndTime } = useFormatters();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: agentIds, isLoading } = useSourcesServiceGetAgentsForSource({
    sourceId: dataSource.id || '',
  });

  const agentCount = useMemo(() => {
    if (isLoading || !agentIds) {
      return '-';
    }

    return agentIds.length;
  }, [isLoading, agentIds]);

  const handleBadgeClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const badgeContent = useMemo(() => {
    if (typeof agentCount !== 'number') {
      return t('dataSourcesList.dataSourceItem.agentCount.plural', {
        count: '-',
      });
    }

    if (agentCount === 1) {
      return t('dataSourcesList.dataSourceItem.agentCount.single', {
        count: agentCount,
      });
    }

    return t('dataSourcesList.dataSourceItem.agentCount.plural', {
      count: agentCount,
    });
  }, [agentCount, t]);

  return (
    <Link href={`/data-sources/${dataSource.id}`}>
      <Card>
        <VStack fullWidth>
          <HStack fullWidth justify="spaceBetween" align="start" gap="medium">
            <VStack gap="medium" flex collapseWidth>
              <Avatar size="medium" name={dataSource.name} />
              <VStack gap="text" fullWidth>
                <Tooltip asChild content={dataSource.name}>
                  <Typography
                    bold
                    align="left"
                    variant="body"
                    noWrap
                    fullWidth
                    overflow="ellipsis"
                  >
                    {dataSource.name}
                  </Typography>
                </Tooltip>
                <HStack>
                  <Typography variant="body" color="muted">
                    {dataSource.created_at
                      ? t('dataSourcesList.dataSourceItem.createdAt', {
                          date: formatDateAndTime(dataSource.created_at),
                        })
                      : t('dataSourcesList.dataSourceItem.noCreatedAt')}
                  </Typography>
                </HStack>
              </VStack>
            </VStack>
            {typeof agentCount === 'number' && agentCount > 0 ? (
              <DropdownMenu
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
                align="end"
                triggerAsChild
                trigger={
                  <div
                    onClick={handleBadgeClick}
                    style={{
                      cursor: 'pointer',
                      padding: 0,
                      margin: 0,
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <Badge
                      content={badgeContent}
                      preIcon={
                        isDropdownOpen ? <CaretUpIcon /> : <CaretDownIcon />
                      }
                      variant="info"
                      size="small"
                      border
                    />
                  </div>
                }
              >
                {agentIds && agentIds.length > 0 ? (
                  agentIds.map((agentId) => (
                    <DropdownMenuItem
                      key={agentId}
                      label={agentId}
                      doNotCloseOnSelect
                    />
                  ))
                ) : (
                  <DropdownMenuItem
                    label={t('dataSourcesList.dataSourceItem.noAttachedAgents')}
                    doNotCloseOnSelect
                  />
                )}
              </DropdownMenu>
            ) : (
              <Badge
                content={badgeContent}
                variant="info"
                size="small"
                border
              />
            )}
          </HStack>
        </VStack>
      </Card>
    </Link>
  );
}

function DataSourcesList(props: DataSourcesListProps) {
  const t = useTranslations('data-sources/page');
  const [debouncedSearch] = useDebouncedValue(props.search, 500);
  const { data, isError } = useSourcesServiceListSources();

  const filteredData = useMemo(() => {
    if (!data || !debouncedSearch) return data;

    return data.filter(
      (source) =>
        source.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        source.instructions
          ?.toLowerCase()
          .includes(debouncedSearch.toLowerCase()),
    );
  }, [data, debouncedSearch]);

  if (!filteredData || isError || filteredData.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={!data}
        isError={isError}
        emptyMessage={
          debouncedSearch
            ? t('dataSourcesList.noSearchResults')
            : t('dataSourcesList.noDataSources')
        }
        emptyAction={<CreateDataSourceDialog />}
        loadingMessage={t('dataSourcesList.loadingMessage')}
      />
    );
  }

  return (
    <NiceGridDisplay>
      {filteredData.map((dataSource) => (
        <DataSourceCard key={dataSource.id} dataSource={dataSource} />
      ))}
    </NiceGridDisplay>
  );
}

function DataSourcesPage() {
  const [search, setSearch] = React.useState('');
  const t = useTranslations('data-sources/page');

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <>
          <CreateDataSourceDialog />
        </>
      }
    >
      <DashboardPageSection
        searchPlaceholder={t('searchInput.placeholder')}
        searchValue={search}
        onSearch={setSearch}
      >
        <DataSourcesList search={search} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DataSourcesPage;
