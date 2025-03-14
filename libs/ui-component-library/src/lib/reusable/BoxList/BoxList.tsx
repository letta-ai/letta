import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { useMemo } from 'react';
import { Skeleton } from '../../core/Skeleton/Skeleton';
import { cn } from '@letta-cloud/ui-styles';

interface BoxListItem {
  title: string;
  description: string;
  action: React.ReactNode;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}

function EmptyState(props: EmptyStateProps) {
  const { icon, title, description, action } = props;

  return (
    <VStack
      color="background-grey"
      align="center"
      fullHeight
      justify="center"
      padding="xlarge"
    >
      <VStack className="max-w-[300px]" align="center" justify="center">
        <VStack
          align="center"
          justify="center"
          className="w-[64px] h-[64px]"
          color="brand-light"
        >
          <Slot className="w-[36px]">{icon}</Slot>
        </VStack>
        <VStack paddingY="small">
          <Typography align="center" variant="heading4" bold>
            {title}
          </Typography>
          <Typography align="center" variant="body" color="lighter">
            {description}
          </Typography>
        </VStack>
        {action}
      </VStack>
    </VStack>
  );
}

interface ListStateProps {
  items: BoxListItem[];
  title?: string;
  bottomAction: React.ReactNode;
}

const ROW_HEIGHT = 'h-[68px]';

function ListState(props: ListStateProps) {
  const { items, bottomAction } = props;

  return (
    <VStack gap="large">
      <VStack align="center" justify="center">
        {items.map((item, index) => (
          <HStack
            className={ROW_HEIGHT}
            justify="spaceBetween"
            align="center"
            paddingX="large"
            paddingY="small"
            key={index}
            border
            fullWidth
          >
            <VStack overflow="hidden" gap={false}>
              <Typography variant="body" bold>
                {item.title}
              </Typography>
              <Typography
                noWrap
                fullWidth
                overflow="ellipsis"
                variant="body"
                color="lighter"
              >
                {item.description}
              </Typography>
            </VStack>
            {item.action}
          </HStack>
        ))}
      </VStack>
      {bottomAction && <div>{bottomAction}</div>}
    </VStack>
  );
}

interface LoadingConfigProps {
  isLoading: boolean;
  rowsToDisplay: number;
}

function LoadingState(props: LoadingConfigProps) {
  const { rowsToDisplay } = props;

  return (
    <VStack gap="large">
      {Array.from({ length: rowsToDisplay }).map((_, index) => (
        <Skeleton key={index} className={cn(ROW_HEIGHT, 'w-full')} />
      ))}
    </VStack>
  );
}

interface BoxListProps {
  title: string;
  icon?: React.ReactNode;
  items: BoxListItem[];
  loadingConfig: LoadingConfigProps;
  emptyConfig: EmptyStateProps;
  topRightAction?: React.ReactNode;
  bottomAction: React.ReactNode;
}

export function BoxList(props: BoxListProps) {
  const {
    title,
    items,
    emptyConfig,
    loadingConfig,
    icon,
    topRightAction,
    bottomAction,
  } = props;

  const hasNoItems = useMemo(() => items.length === 0, [items]);

  const component = useMemo(() => {
    if (loadingConfig.isLoading) {
      return <LoadingState {...loadingConfig} />;
    }

    if (hasNoItems) {
      return <EmptyState {...emptyConfig} />;
    }

    return <ListState items={items} bottomAction={bottomAction} />;
  }, [loadingConfig, hasNoItems, emptyConfig, items, bottomAction]);

  return (
    <VStack fullWidth fullHeight border gap="large" padding>
      <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
        <HStack align="center">
          {icon && <Slot className="w-[20px]">{icon}</Slot>}
          <Typography variant="large" bold>
            {title}
          </Typography>
        </HStack>
        {!hasNoItems && topRightAction}
      </HStack>
      {component}
    </VStack>
  );
}
