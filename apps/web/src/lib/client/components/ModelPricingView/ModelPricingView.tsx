import { useTranslations } from '@letta-cloud/translations';
import {
  brandKeyToLogo,
  HStack,
  InfoTooltip,
  isBrandKey,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  RawSlider,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useMemo, useState } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  useCurrencyFormatter,
  useNumberFormatter,
} from '@letta-cloud/utils-client';
import { creditsToDollars } from '@letta-cloud/utils-shared';

interface StepCostPerModel {
  model: string;
  brand: string;
  id: string;
  cost: number;
}

function getCostFromCostMap(
  cost: number,
  costMap: Record<number, number | undefined>,
) {
  for (const key in costMap) {
    // Check if the cost is less than or equal to the key
    if (cost <= Number(key)) {
      return costMap[key] || -1;
    }
  }

  return -1;
}

interface CostRenderProps {
  cost: number;
}

function CostRender(props: CostRenderProps) {
  const t = useTranslations('components/ModelPricingView');
  const { formatNumber } = useNumberFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const { cost } = props;

  if (cost === -1) {
    return (
      <HStack align="center" gap="small">
        <Typography variant="body3">{t('notSupported.label')}</Typography>
        <InfoTooltip text={t('notSupported.description')} />
      </HStack>
    );
  }

  return (
    <HStack align="center" gap="small">
      <LettaCoinIcon size="xsmall" />
      <Typography variant="body3">{formatNumber(cost)}</Typography>
      <Typography variant="body3">
        (
        {formatCurrency(creditsToDollars(cost), {
          maximumFractionDigits: 3,
          minimumFractionDigits: 3,
          style: 'currency',
          currency: 'USD',
        })}
        )
      </Typography>
    </HStack>
  );
}

interface ModelRenderProps {
  item: StepCostPerModel;
}

function ModelRender(props: ModelRenderProps) {
  const { item } = props;

  return (
    <HStack
      align="center"
      borderBottom
      key={item.id}
      padding="large"
      justify="spaceBetween"
    >
      <HStack>
        {isBrandKey(item.brand) ? brandKeyToLogo(item.brand) : null}
        <Typography variant="body" bold>
          {item.model}
        </Typography>
      </HStack>
      <CostRender cost={item.cost} />
    </HStack>
  );
}

export function ModelPricingView() {
  const t = useTranslations('components/ModelPricingView');
  const [contextWindowSize, setContextWindowSize] = useState<string>('32000');

  const { data: costs } = webApi.costs.getStepCosts.useQuery({
    queryKey: webApiQueryKeys.costs.getStepCosts,
  });

  const stepCosts = useMemo(() => {
    return costs?.body.stepCosts || [];
  }, [costs]);

  const stepCostPerModal = useMemo(() => {
    return stepCosts.map((stepCost) => {
      return {
        model: stepCost.modelName,
        brand: stepCost.brand,
        id: stepCost.modelId,
        cost: getCostFromCostMap(Number(contextWindowSize), stepCost.costMap),
      };
    });
  }, [contextWindowSize, stepCosts]);

  const maxContextWindowSize = useMemo(() => {
    return (
      Math.max(
        ...stepCosts.map((stepCost) => {
          return Math.max(
            ...Object.keys(stepCost.costMap).map((key) => Number(key)),
          );
        }),
      ) || 200000
    );
  }, [stepCosts]);

  return (
    <VStack fullHeight fullWidth>
      <VStack border padding>
        <RawSlider
          fullWidth
          label={t('contextWindowSize.label')}
          value={contextWindowSize}
          onValueChange={setContextWindowSize}
          min={0}
          max={maxContextWindowSize}
          step={10}
        />
      </VStack>
      <VStack border gap={false} collapseHeight flex overflow="auto">
        {!costs ? (
          <LoadingEmptyStatusComponent
            loadingMessage={t('loading')}
            isLoading
          />
        ) : (
          stepCostPerModal
            .sort((a, b) => b.cost - a.cost)
            .map((item) => <ModelRender key={item.model} item={item} />)
        )}
      </VStack>
    </VStack>
  );
}
