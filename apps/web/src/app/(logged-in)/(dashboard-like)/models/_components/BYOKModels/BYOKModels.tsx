import React, { useMemo, useState } from 'react';
import {
  Alert,
  brandKeyToLogo,
  brandKeyToOwnerMap,
  Button,
  ChevronRightIcon,
  Section,
  DataTable,
  HStack,
  isBrandKey,
  LettaLoader,
  ModelsIcon,
  PlusIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { AddProviderModal } from '../AddProviderModal/AddProviderModal';
import type { Provider } from '@letta-cloud/sdk-core';
import { useProvidersServiceListProviders } from '@letta-cloud/sdk-core';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { ProviderDetailsOverlay } from '../ProviderDetailsOverlay/ProviderDetailsOverlay';
import { getUseProvidersServiceModelsStandardArgs } from '../utils/getUseProvidersServiceModelsStandardArgs/getUseProvidersServiceModelsStandardArgs';

function NoProviders() {
  const t = useTranslations('pages/models/BYOKModels');

  return (
    <HStack padding="small" border color="background-grey">
      <ModelsIcon />
      <Typography variant="body">{t('NoProviders.title')}</Typography>
    </HStack>
  );
}

interface ProviderTableProps {
  providers: Provider[];
  isLoading: boolean;
}

function ProviderTable(props: ProviderTableProps) {
  const { providers, isLoading } = props;

  const t = useTranslations('pages/models/BYOKModels');
  const { formatDateAndTime } = useFormatters();

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null,
  );

  const columns: Array<ColumnDef<Provider>> = useMemo(
    () => [
      {
        header: t('ProviderTable.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('ProviderTable.columns.provider'),
        accessorKey: 'provider',
        cell: ({ row }) => {
          const { provider_type } = row.original;

          if (!isBrandKey(provider_type)) {
            return provider_type;
          }

          return (
            <HStack>
              {brandKeyToLogo(provider_type)}
              <Typography>{brandKeyToOwnerMap[provider_type]}</Typography>
            </HStack>
          );
        },
      },
      {
        header: t('ProviderTable.columns.updatedAt'),
        cell: ({ row }) => {
          const { updated_at } = row.original;

          if (!updated_at) {
            return <div />;
          }

          return <Typography>{formatDateAndTime(updated_at)}</Typography>;
        },
      },
      {
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: () => <ChevronRightIcon color="muted" />,
      },
    ],
    [formatDateAndTime, t],
  );

  return (
    <>
      {selectedProvider && (
        <ProviderDetailsOverlay
          provider={selectedProvider}
          setOpen={(status) => {
            if (!status) {
              setSelectedProvider(null);
            }
          }}
          open={!!selectedProvider}
        />
      )}
      <DataTable
        onRowClick={(row) => {
          setSelectedProvider(row);
        }}
        isLoading={isLoading}
        columns={columns}
        data={providers}
      />
    </>
  );
}

function ProvidersView() {
  const {
    isError,
    isLoading,
    data: providers,
  } = useProvidersServiceListProviders(
    getUseProvidersServiceModelsStandardArgs(),
  );

  const t = useTranslations('pages/models/BYOKModels');

  if (isLoading || !providers) {
    return (
      <HStack
        align="center"
        justify="center"
        padding="small"
        fullWidth
        border
        color="background-grey"
      >
        <LettaLoader variant="grower" />
      </HStack>
    );
  }

  if (isError) {
    return (
      <Alert title={t('ProvidersView.error')} variant="destructive"></Alert>
    );
  }

  if (providers.length === 0) {
    return <NoProviders />;
  }

  return <ProviderTable isLoading={isLoading} providers={providers} />;
}

export function BYOKModels() {
  const t = useTranslations('pages/models/BYOKModels');

  return (
    <Section
      description={t('description')}
      title={t('title')}
    >
      <VStack gap="medium">
        <ProvidersView />
        <div>
          <AddProviderModal
            trigger={
              <Button
                preIcon={<PlusIcon />}
                label={t('actions.addProvider')}
                color="secondary"
              />
            }
          />
        </div>
      </VStack>
    </Section>
  );
}
