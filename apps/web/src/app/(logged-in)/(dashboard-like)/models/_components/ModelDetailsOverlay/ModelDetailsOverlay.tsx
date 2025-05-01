import type { CostItemType } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  InfoTooltip,
  Section,
  SideOverlay,
  SideOverlayHeader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ModelName } from '../ModelName/ModelName';
import { useCurrencyFormatter } from '@letta-cloud/utils-client';
import { creditsToDollars } from '@letta-cloud/utils-shared';

interface CostsTableProps {
  model: CostItemType;
}

function ModelCostsTable(props: CostsTableProps) {
  const { model } = props;

  const t = useTranslations('pages/models/ModelDetailsOverlay');

  const { formatCurrency } = useCurrencyFormatter();

  return (
    <Section
      title={t('ModelCostsTable.title')}
      description={t('ModelCostsTable.description')}
    >
      <VStack gap={false} border>
        <HStack padding="small" justify="spaceBetween" fullWidth>
          <HStack>
            <Typography variant="body4" bold uppercase color="muted">
              {t('ModelCostsTable.maxContextWindow')}
            </Typography>
            <InfoTooltip text={t('ModelCostsTable.maxContextWindowTooltip')} />
          </HStack>
          <Typography variant="body4" bold uppercase color="muted">
            {t('ModelCostsTable.costPerStep')}
          </Typography>
        </HStack>
        {Object.entries(model.costMap).map(([contextWindowSize, cost]) => (
          <HStack
            borderTop
            key={contextWindowSize}
            fullWidth
            justify="spaceBetween"
            padding="small"
          >
            <Typography variant="body2">{contextWindowSize}</Typography>
            <HStack gap="small" align="center">
              <Typography variant="body2">
                {formatCurrency(creditsToDollars(cost), {
                  minimumFractionDigits: 3,
                })}
              </Typography>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Section>
  );
}

interface ModelDetailsOverlayProps {
  model: CostItemType;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function ModelDetailsOverlay(props: ModelDetailsOverlayProps) {
  const { model, setOpen, open } = props;

  const t = useTranslations('pages/models/ModelDetailsOverlay');

  return (
    <>
      <SideOverlay title={t('title')} isOpen={open} onOpenChange={setOpen}>
        <VStack gap={false}>
          <SideOverlayHeader>
            <ModelName modelName={model.modelName} brand={model.brand} />
          </SideOverlayHeader>
          <VStack padding>
            <ModelCostsTable model={model} />
          </VStack>
        </VStack>
      </SideOverlay>
    </>
  );
}
