import type { CostItemType } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import {
  useCurrencyFormatter,
  useNumberFormatter,
} from '@letta-cloud/utils-client';
import {
  type BrandKeys,
  brandKeyToLogo,
  brandKeyToName,
  HStack,
  isBrandKey,
  LettaCoinIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { Slot } from '@radix-ui/react-slot';

interface CostRenderProps {
  cost: CostItemType;
}

function CostRender(props: CostRenderProps) {
  const { cost } = props;
  const { modelName, costMap } = cost;

  const costs = useMemo(() => {
    return Object.entries(costMap).map(([contextWindowSize, cost]) => ({
      contextWindowSize,
      cost,
    }));
  }, [costMap]);

  const { formatNumber } = useNumberFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  return (
    <VStack fullWidth>
      <Typography bold variant="body2">
        {modelName}
      </Typography>
      <VStack fullWidth>
        <HStack fullWidth justify="spaceBetween">
          <Typography variant="body4" bold uppercase color="muted">
            Max Tokens
          </Typography>
          <Typography variant="body4" bold uppercase color="muted">
            Cost
          </Typography>
        </HStack>
        {costs.map(({ contextWindowSize, cost }) => (
          <HStack fullWidth justify="spaceBetween" key={contextWindowSize}>
            <Typography variant="body2">{contextWindowSize}</Typography>
            <HStack gap="small" align="center">
              <LettaCoinIcon />
              <Typography variant="body2">{formatNumber(cost)}</Typography>
              <Typography variant="body4" overrideEl="span">
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
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

interface BrandSectionProps {
  item: CostsByBrand;
}

function BrandSection(props: BrandSectionProps) {
  const { item } = props;

  const { brand, costs } = item;

  return (
    <HStack border padding>
      <VStack
        borderRight
        /* eslint-disable-next-line react/forbid-component-props */
        className="min-w-[100px]"
      >
        <Slot
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-8"
        >
          {brandKeyToLogo(brand)}
        </Slot>{' '}
        <Typography variant="large" bold>
          {brandKeyToName(brand)}
        </Typography>
      </VStack>
      <VStack fullWidth gap="large">
        {costs.map((cost) => {
          return <CostRender key={cost.modelId} cost={cost} />;
        })}
      </VStack>
    </HStack>
  );
}

interface CostsByBrand {
  brand: BrandKeys;
  costs: CostItemType[];
}

interface CostsByBrand {
  brand: BrandKeys;
  costs: CostItemType[];
}

interface DetailedCostBreakdownProps {
  costs: CostItemType[];
}

export function ModelPricingBlocks(props: DetailedCostBreakdownProps) {
  const { costs } = props;
  const costsByBrand = useMemo(() => {
    const brandMap = new Map<string, CostsByBrand>();

    costs.forEach((cost) => {
      if (!isBrandKey(cost.brand)) {
        return;
      }

      if (!brandMap.has(cost.brand)) {
        brandMap.set(cost.brand, { brand: cost.brand, costs: [] });
      }

      brandMap.get(cost.brand)?.costs.push(cost);
    });

    return Array.from(brandMap.values());
  }, [costs]);

  return costsByBrand.map((brandCosts) => (
    <BrandSection item={brandCosts} key={brandCosts.brand} />
  ));
}
