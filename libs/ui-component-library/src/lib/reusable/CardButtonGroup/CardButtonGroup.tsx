import {
  CardButton,
  VStack,
  type CardButtonProps,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import Link from 'next/link';
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
  className?: string;
  projectUrl: string;
  projectLabel: string;
}

function CardButtonGroupComponent(props: CardButtonGroupProps) {
  const { items, isLoading, minRows, emptyConfig, projectUrl, projectLabel } =
    props;
  const t = useTranslations('components/CardButtonGroup');

  // Load skeleton based on minimum rows
  if (isLoading) {
    return Array.from({ length: minRows || 1 }).map((_, index) => (
      <CardButton key={`loading-${index}`} id={`loading-${index}`} />
    ));
  }

  if (items && items.length > 0) {
    return items.map((item: CardButtonProps) => (
      <Tooltip key={item.id} content={t('goTo', { item: item.label })}>
        <CardButton
          key={`card-${item.id}`}
          id={item.id}
          label={item.label}
          url={item.url}
          preIcon={item.preIcon}
        />
      </Tooltip>
    ));
  }

  return (
    <Link href={projectUrl}>
      <Tooltip asChild content={t('goTo', { item: projectLabel })}>
        <VStack
          align="center"
          justify="center"
          border="dashed"
          className={cn('w-full cursor-pointer', emptyConfig?.className)}
        >
          <Typography variant="body2" color="muted">
            {emptyConfig?.label || t('noItemsFound')}
          </Typography>
        </VStack>
      </Tooltip>
    </Link>
  );
}

export function CardButtonGroup(props: CardButtonGroupProps) {
  const {
    items,
    isLoading,
    minRows,
    emptyConfig,
    className,
    projectUrl,
    projectLabel,
  } = props;

  return (
    <VStack gap="small" className={className ?? ''} fullHeight>
      <CardButtonGroupComponent
        items={items}
        isLoading={isLoading}
        minRows={minRows}
        emptyConfig={emptyConfig}
        projectUrl={projectUrl}
        projectLabel={projectLabel}
      />
    </VStack>
  );
}
