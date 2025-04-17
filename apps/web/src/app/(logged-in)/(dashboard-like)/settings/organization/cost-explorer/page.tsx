'use client';
import type { CostItemType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  TabGroup,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useInferenceModels } from './ModelSelector';
import { useQueryClient } from '@tanstack/react-query';
import { ModelPricingBlocks } from '$web/client/components/ModelPricingBlocks/ModelPricingBlocks';
import { ModelPricingView } from '$web/client/components/ModelPricingView/ModelPricingView';

interface DetailedCostBreakdownProps {
  costs: CostItemType[];
}

type PricingModes = 'simulator' | 'table';

function DetailedCostBreakdown(props: DetailedCostBreakdownProps) {
  const { costs } = props;
  const [mode, setMode] = useState<PricingModes>('table');
  const t = useTranslations('organization/costs');

  return (
    <VStack>
      <HStack>
        <TabGroup
          border
          variant="chips"
          items={[
            {
              label: t('DetailedCostBreakdown.pricingTable'),
              value: 'table',
            },
            {
              label: t('DetailedCostBreakdown.simulator'),
              value: 'simulator',
            },
          ]}
          onValueChange={(value) => {
            setMode(value as PricingModes);
          }}
          value={mode}
        />
      </HStack>
      {mode === 'simulator' ? (
        <ModelPricingView />
      ) : (
        <NiceGridDisplay itemWidth="600px">
          <ModelPricingBlocks costs={costs} />
        </NiceGridDisplay>
      )}
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

  const stepCosts = useMemo(() => {
    if (!costs) {
      return [];
    }

    return costs.body.stepCosts;
  }, [costs]);

  return (
    <DashboardPageLayout
      title={t('title')}
      cappedWidth
      subtitle={t.rich('description', {
        credit: () => <LettaCoinIcon size="small" />,
      })}
    >
      {!costs ? (
        <DashboardPageSection fullHeight>
          <LoadingEmptyStatusComponent isLoading />
        </DashboardPageSection>
      ) : (
        <DashboardPageSection fullHeight>
          <VStack fullHeight overflow="hidden">
            <DetailedCostBreakdown costs={stepCosts} />
          </VStack>
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default CostExplorer;
