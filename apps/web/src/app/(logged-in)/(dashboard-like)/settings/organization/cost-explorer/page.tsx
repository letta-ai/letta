'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import type { CostItemType } from '@letta-cloud/sdk-web';
import {
  brandKeyToLogo,
  brandKeyToName,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  HStack,
  InfoIcon,
  isBrandKey,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  RawInput,
  Typography,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { ModelSelector, useInferenceModels } from './ModelSelector';
import {
  useCurrencyFormatter,
  useNumberFormatter,
} from '@letta-cloud/utils-client';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { useQueryClient } from '@tanstack/react-query';
import { Slot } from '@radix-ui/react-slot';

function CostSimulator() {
  const t = useTranslations('organization/costs');
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const [estimatedRequests, setEstimatedRequests] = useState<string>('10');
  const [estimatedContextWindowSize, setEstimatedContextWindowSize] =
    useState<string>('8000');

  const [estimatedCost, setEstimatedCost] = useState<
    number | 'not-supported' | undefined
  >(undefined);
  const { data: selectedModel, isLoading } =
    webApi.costs.getStepCostByModelId.useQuery({
      queryKey: webApiQueryKeys.costs.getStepCostByModelId(modelId || ''),
      queryData: {
        params: {
          modelId: modelId || '',
        },
      },
      enabled: !!modelId,
    });

  useEffect(() => {
    setEstimatedCost(undefined);
  }, [modelId, estimatedRequests, estimatedContextWindowSize]);

  const handleSimulate = useCallback(async () => {
    if (!modelId) {
      return;
    }

    if (!selectedModel) {
      return;
    }

    const contextWindowPriceToUse = Object.entries(selectedModel.body.costMap)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .find(
        ([windowSize]) =>
          parseInt(windowSize, 10) >= parseInt(estimatedContextWindowSize, 10),
      );

    if (!contextWindowPriceToUse) {
      setEstimatedCost('not-supported');
      return;
    }

    const [_, cost] = contextWindowPriceToUse;

    setEstimatedCost(cost * parseInt(estimatedRequests, 10));
  }, [modelId, selectedModel, estimatedRequests, estimatedContextWindowSize]);

  const { formatNumber } = useNumberFormatter();
  const { formatCurrency } = useCurrencyFormatter();

  const parsedEstimatedCost = useMemo(() => {
    if (estimatedCost === 'not-supported') {
      return t('CostSimulator.notSupported');
    }

    return formatNumber(estimatedCost || 0);
  }, [estimatedCost, t, formatNumber]);

  const parsedEstimatedCash = useMemo(() => {
    if (estimatedCost === 'not-supported') {
      return t('CostSimulator.notSupported');
    }

    return formatCurrency(creditsToDollars(estimatedCost || 0), {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
      currency: 'USD',
    });
  }, [estimatedCost, t, formatCurrency]);

  return (
    <Dialog
      disableForm
      title={t('CostSimulator.title')}
      trigger={<Button color="primary" label={t('CostSimulator.trigger')} />}
      hideFooter
      size="large"
      color="background"
    >
      <HStack gap="xlarge" paddingBottom>
        <VStack gap="form" paddingBottom>
          <ModelSelector
            currentModelId={modelId || ''}
            onSelectModelId={(selectedModel) => {
              setModelId(selectedModel);
            }}
          />
          <HStack align="end">
            <RawInput
              labelVariant="simple"
              label={t('CostSimulator.estimatedRequests.label')}
              infoTooltip={{
                text: t('CostSimulator.estimatedRequests.tooltip'),
              }}
              placeholder={t('CostSimulator.estimatedRequests.placeholder')}
              value={estimatedRequests}
              fullWidth
              onChange={(e) => {
                setEstimatedRequests(e.target.value);
              }}
            />
            <RawInput
              labelVariant="simple"
              label={t('CostSimulator.estimatedContextWindowSize.label')}
              placeholder={t(
                'CostSimulator.estimatedContextWindowSize.placeholder',
              )}
              infoTooltip={{
                text: t('CostSimulator.estimatedContextWindowSize.tooltip'),
              }}
              value={estimatedContextWindowSize}
              fullWidth
              postIcon={t('CostSimulator.tokens')}
              onChange={(e) => {
                setEstimatedContextWindowSize(e.target.value);
              }}
            />
          </HStack>
          <Button
            fullWidth
            type="button"
            disabled={isLoading}
            color="primary"
            onClick={handleSimulate}
            size="large"
            label={t('CostSimulator.simulate')}
          />
        </VStack>
        <VStack
          color="background-grey"
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full max-w-[33%]"
          padding
          align="start"
          justify="spaceBetween"
        >
          {estimatedCost === 'not-supported' && (
            <VStack align="center">
              <WarningIcon size="large" />
              <Typography bold color="lighter">
                {t('CostSimulator.notSupportedInfo')}
              </Typography>
            </VStack>
          )}
          {!estimatedCost && (
            <VStack align="center">
              <InfoIcon size="medium" />
              <Typography bold color="lighter">
                {t('CostSimulator.defaultInfo')}
              </Typography>
            </VStack>
          )}
          {typeof estimatedCost === 'number' && (
            <VStack gap={false}>
              <Typography bold color="lighter">
                {t('CostSimulator.estimatedCost')}
              </Typography>
              <HStack paddingBottom align="start">
                <Typography bold variant="heading3" overrideEl="span">
                  <HStack paddingTop="small" align="center" as="span">
                    <LettaCoinIcon size="small" />
                    {parsedEstimatedCost}
                  </HStack>
                  <Typography variant="heading6">
                    {parsedEstimatedCash}
                  </Typography>
                </Typography>
              </HStack>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Dialog>
  );
}

interface BrandTableProps {
  brand: string;
  costList: CostItemType[];
}

function BrandTable(props: BrandTableProps) {
  const { brand, costList } = props;
  const isBrand = isBrandKey(brand);

  const t = useTranslations('organization/costs');
  const columns: Array<ColumnDef<CostItemType>> = useMemo(() => {
    if (!costList) {
      return [];
    }

    const nextColumns = [
      {
        id: 'modelName',
        header: t('columns.name'),
        accessorKey: 'modelName',
      },
    ];

    const columnSet = new Set<string>();

    costList.forEach((cost) => {
      Object.keys(cost.costMap).forEach((windowSize) => {
        columnSet.add(windowSize);
      });
    });

    const windowSizesSorted = Array.from(columnSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );

    return [
      ...nextColumns,
      ...windowSizesSorted.map((windowSize) => {
        return {
          id: windowSize.toString(),
          header: t('columns.tokens', { tokens: windowSize }),
          // @ts-expect-error - not typed
          cell: ({ row }) => {
            const costMap = row.original.costMap;
            let creditAmount = costMap[windowSize];

            if (!creditAmount) {
              // find the next available window size
              const nextAvailableWindowSize = Object.keys(
                row.original.costMap,
              ).find((key) => parseInt(key, 10) > parseInt(windowSize, 10));

              if (nextAvailableWindowSize) {
                creditAmount = costMap[nextAvailableWindowSize];
              } else {
                // else credit is not supported
                return t('notSupported');
              }
            }

            return (
              <HStack gap="small" align="center">
                <LettaCoinIcon size="xsmall" />
                {creditAmount}
              </HStack>
            );
          },
        };
      }),
    ];
  }, [costList, t]);

  if (!isBrand) {
    return null;
  }

  return (
    <VStack key={brand} gap="large">
      <HStack paddingX="small">
        <Slot
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-6 h-6"
        >
          {brandKeyToLogo(brand)}
        </Slot>
        <Typography variant="heading5">{brandKeyToName(brand)}</Typography>
      </HStack>
      <DataTable key={brand} columns={columns} data={costList} />
    </VStack>
  );
}

function CostExplorer() {
  const limit = 150;
  useInferenceModels();

  const t = useTranslations('organization/costs');

  const queryClient = useQueryClient();

  const { data: costs } = webApi.costs.getStepCosts.useQuery({
    queryKey: webApiQueryKeys.costs.getStepCosts,
    enabled: !!limit,
  });

  useEffect(() => {
    if (!costs) {
      return;
    }

    costs.body.stepCosts.forEach((cost) => {
      queryClient.setQueryData(
        webApiQueryKeys.costs.getStepCostByModelId(cost.modelId),
        {
          status: 200,
          body: cost,
        },
      );
    });
  }, [costs, queryClient]);

  const costListByBrand = useMemo(() => {
    if (!costs) {
      return [];
    }

    const map = costs.body.stepCosts.reduce(
      (acc, cost) => {
        const brand = cost.brand;

        if (!acc[brand]) {
          acc[brand] = [] as CostItemType[];
        }

        acc[brand].push(cost);

        return acc;
      },
      {} as Record<string, CostItemType[]>,
    );

    return Object.entries(map);
  }, [costs]);

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={<CostSimulator />}
      subtitle={t.rich('description', {
        credit: () => <LettaCoinIcon size="small" />,
      })}
    >
      {!costs ? (
        <DashboardPageSection>
          <LoadingEmptyStatusComponent isLoading />
        </DashboardPageSection>
      ) : (
        <DashboardPageSection>
          <VStack gap="large">
            {costListByBrand.map(([brand, costList]) => {
              return (
                <BrandTable key={brand} brand={brand} costList={costList} />
              );
            })}
          </VStack>
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default CostExplorer;
