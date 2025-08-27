import {
  CardButton,
  VStack,
  type CardButtonProps,
} from '@letta-cloud/ui-component-library';
import { Typography } from '../../core/Typography/Typography';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';

interface EmptyConfig {
  label?: string;
  className?: string;
}

interface CardButtonGroupProps {
  items?: CardButtonProps[];
  isLoading?: boolean;
  minRows?: number;
  emptyConfig?: EmptyConfig;
}

function CardButtonGroupComponent(props: CardButtonGroupProps) {
  const { items, isLoading, minRows, emptyConfig } = props;
  const t = useTranslations('components/CardButtonGroup');

  // Load skeleton based on minimum rows
  if (isLoading) {
    return Array.from({ length: minRows || 1 }).map((_, index) => (
      <CardButton key={`loading-${index}`} id={`loading-${index}`} />
    ));
  }

  if (items && items.length > 0) {
    return items.map((item: CardButtonProps) => (
      <CardButton
        key={`card-${item.id}`}
        id={item.id}
        label={item.label}
        url={item.url}
        preIcon={item.preIcon}
      />
    ));
  }

  return (
    <VStack
      align="center"
      justify="center"
      border="dashed"
      className={cn('w-full cursor-default', emptyConfig?.className)}
    >
      <Typography variant="body2" color="muted">
        {emptyConfig?.label || t('noItemsFound')}
      </Typography>
    </VStack>
  );
}

export function CardButtonGroup(props: CardButtonGroupProps) {
  const { items, isLoading, minRows, emptyConfig } = props;

  return (
    <VStack gap="small">
      <CardButtonGroupComponent
        items={items}
        isLoading={isLoading}
        minRows={minRows}
        emptyConfig={emptyConfig}
      />
    </VStack>
  );
}
