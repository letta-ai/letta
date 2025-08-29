'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  DesktopPageLayout,
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
  DatabaseIcon,
} from '@letta-cloud/ui-component-library';
import { isAPIError, type Source } from '@letta-cloud/sdk-core';
import {
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
  useSourcesServiceGetAgentsForSource,
  useSourcesServiceListSources,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { useDebouncedValue } from '@mantine/hooks';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';

const createDataSourceSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().optional(),
});

type CreateDataSourceSchemaType = z.infer<typeof createDataSourceSchema>;

interface CreateDataSourceDialogProps {
  isDesktop?: boolean;
  onNavigate?: (dataSourceId: string) => void;
  canCreateDataSource?: boolean;
}

function CreateDataSourceDialog({
  isDesktop,
  onNavigate,
  canCreateDataSource = true,
}: CreateDataSourceDialogProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const t = useTranslations('DataSourcesList');

  const form = useForm<CreateDataSourceSchemaType>({
    resolver: zodResolver(createDataSourceSchema),
    defaultValues: {
      name: '',
      instructions: '',
    },
    mode: 'onSubmit',
  });

  const { mutate, isPending, error } = useSourcesServiceCreateSource({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListSourcesKeyFn(),
      });

      form.reset();
      form.clearErrors();
      setIsOpen(false);

      if (onNavigate && response.id) {
        onNavigate(response.id);
      }
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error) && error.status === 402) {
        return isDesktop
          ? t('CreateDataSourceDialog.errors.overage')
          : t.rich('CreateDataSourceDialog.errors.overage', {
              link: (chunks: React.ReactNode) => (
                <BillingLink>{chunks}</BillingLink>
              ),
            });
      }

      return t('CreateDataSourceDialog.errors.default');
    }

    return undefined;
  }, [error, t, isDesktop]);

  const handleSubmit = useCallback(
    (values: CreateDataSourceSchemaType) => {
      const requestBody: {
        name: string;
        instructions: string;
        embedding?: string;
      } = {
        name: values.name,
        instructions: values.instructions || '',
      };

      if (isDesktop) {
        requestBody.embedding = DEFAULT_EMBEDDING_MODEL;
      }

      mutate({
        requestBody,
      });
    },
    [mutate, isDesktop],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        form.reset();
        form.clearErrors();
      }
    },
    [form],
  );

  if (!isDesktop && !canCreateDataSource) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('CreateDataSourceDialog.title')}
        confirmText={t('CreateDataSourceDialog.createButton')}
        trigger={
          <Button
            label={t('CreateDataSourceDialog.trigger')}
            preIcon={<PlusIcon />}
          />
        }
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
      >
        <VStack gap="medium">
          <FormField
            render={({ field }) => (
              <Input
                {...field}
                fullWidth
                label={t('CreateDataSourceDialog.name.label')}
              />
            )}
            name="name"
          />
          <FormField
            render={({ field }) => (
              <TextArea
                {...field}
                fullWidth
                label={t('CreateDataSourceDialog.instructions.label')}
                rows={3}
              />
            )}
            name="instructions"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface DataSourceCardProps {
  dataSource: Source;
  isDesktop?: boolean;
  onNavigate?: (dataSourceId: string) => void;
  LinkComponent?: React.ComponentType<{ href: string; children: React.ReactNode }>;
}

function DataSourceCard({
  dataSource,
  isDesktop,
  onNavigate,
  LinkComponent,
}: DataSourceCardProps) {
  const t = useTranslations('DataSourcesList');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  let formatDateAndTime: (date: string) => string;
  try {
    const formatters = useFormatters();
    formatDateAndTime = formatters.formatDateAndTime;
  } catch {
    formatDateAndTime = (date: string) => new Date(date).toLocaleDateString();
  }

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

  const handleCardClick = useCallback(() => {
    if (onNavigate && dataSource.id) {
      onNavigate(dataSource.id);
    }
  }, [onNavigate, dataSource.id]);

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

  function getCreatedAtText() {
    if (!dataSource.created_at) {
      return t('dataSourcesList.dataSourceItem.noCreatedAt');
    }

    const formattedDate = formatDateAndTime(dataSource.created_at);
    return t('dataSourcesList.dataSourceItem.createdAt', {
      date: formattedDate,
    });
  }

  const cardContent = (
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
                {getCreatedAtText()}
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
                  preIcon={isDropdownOpen ? <CaretUpIcon /> : <CaretDownIcon />}
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
                label={
                  isDesktop
                    ? 'No agents attached'
                    : t?.('dataSourcesList.dataSourceItem.noAttachedAgents') ||
                      'No agents attached'
                }
                doNotCloseOnSelect
              />
            )}
          </DropdownMenu>
        ) : (
          <Badge content={badgeContent} variant="info" size="small" border />
        )}
      </HStack>
    </VStack>
  );

  if (!isDesktop && LinkComponent && dataSource.id) {
    return (
      <LinkComponent href={`/data-sources/${dataSource.id}`}>
        <Card>{cardContent}</Card>
      </LinkComponent>
    );
  }

  return (
    <Card onClick={onNavigate ? handleCardClick : undefined}>
      {cardContent}
    </Card>
  );
}

interface DataSourcesViewProps {
  search: string;
  isDesktop?: boolean;
  onNavigate?: (dataSourceId: string) => void;
  LinkComponent?: React.ComponentType<{ href: string; children: React.ReactNode }>;
}

function DataSourcesView({
  search,
  isDesktop,
  onNavigate,
  LinkComponent,
}: DataSourcesViewProps) {
  const t = useTranslations('DataSourcesList');
  const [debouncedSearch] = useDebouncedValue(search, 500);
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

  function getEmptyMessage() {
    if (debouncedSearch) {
      return t('dataSourcesList.noSearchResults');
    }
    return t('dataSourcesList.noDataSources');
  }

  function getLoadingMessage() {
    return t('dataSourcesList.loadingMessage');
  }

  if (!filteredData || isError || filteredData.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={!data}
        isError={isError}
        emptyMessage={getEmptyMessage()}
        emptyAction={
          <CreateDataSourceDialog
            isDesktop={isDesktop}
            onNavigate={onNavigate}
          />
        }
        loadingMessage={getLoadingMessage()}
      />
    );
  }

  return (
    <NiceGridDisplay>
      {filteredData.map((dataSource) => (
        <DataSourceCard
          key={dataSource.id}
          dataSource={dataSource}
          isDesktop={isDesktop}
          onNavigate={onNavigate}
          LinkComponent={LinkComponent}
        />
      ))}
    </NiceGridDisplay>
  );
}

interface DataSourcesListProps {
  isDesktop?: boolean;
  onNavigate?: (dataSourceId: string) => void;
  canCreateDataSource?: boolean;
  LinkComponent?: React.ComponentType<{ href: string; children: React.ReactNode }>;
}

export function DataSourcesList({
  isDesktop,
  onNavigate,
  canCreateDataSource = true,
  LinkComponent,
}: DataSourcesListProps) {
  const [search, setSearch] = React.useState('');
  const t = useTranslations('DataSourcesList');

  const content = (
    <DataSourcesView
      search={search}
      isDesktop={isDesktop}
      onNavigate={onNavigate}
      LinkComponent={LinkComponent}
    />
  );

  if (isDesktop) {
    return (
      <DesktopPageLayout
        icon={<DatabaseIcon />}
        title={t('title')}
        actions={
          <CreateDataSourceDialog
            isDesktop={isDesktop}
            onNavigate={onNavigate}
            canCreateDataSource={canCreateDataSource}
          />
        }
      >
        <VStack fullWidth fullHeight paddingX="small" paddingTop="small">
          {content}
        </VStack>
      </DesktopPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <CreateDataSourceDialog
          isDesktop={isDesktop}
          onNavigate={onNavigate}
          canCreateDataSource={canCreateDataSource}
        />
      }
    >
      <DashboardPageSection
        searchPlaceholder={t('searchInput.placeholder')}
        searchValue={search}
        onSearch={setSearch}
      >
        {content}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
