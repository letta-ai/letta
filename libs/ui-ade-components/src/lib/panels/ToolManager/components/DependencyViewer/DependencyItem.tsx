import {
  Button,
  HStack,
  PlusIcon,
  Typography,
  VStack,
  CheckIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { Dependency } from './types';

interface DependencyItemProps {
  dependency: Dependency;
  isAdded: boolean;
  isPending: boolean;
  onAdd: (dependency: Dependency) => void;
}

export function DependencyItem({
  dependency,
  isAdded,
  isPending,
  onAdd,
}: DependencyItemProps) {
  const t = useTranslations('DependencyViewer');

  return (
    <VStack
      key={dependency.id}
      gap={false}
      borderBottom
      padding="medium"
      fullWidth
    >
      <HStack justify="spaceBetween" align="start" fullWidth gap="medium">
        <VStack gap="small" flex>
          <Typography bold>
            {dependency.name}{' '}
            <Typography
              variant="body3"
              color="lighter"
              inline
              overrideEl="span"
            >
              {dependency.version}
            </Typography>
          </Typography>
          <Typography variant="body2" color="muted">
            {dependency.description}
          </Typography>
        </VStack>
        <HStack gap="small" align="start">
          <Button
            label={isAdded ? t('button.added') : t('button.add')}
            size="small"
            color={isAdded ? 'primary' : 'secondary'}
            bold
            preIcon={
              isPending ? undefined : isAdded ? <CheckIcon /> : <PlusIcon />
            }
            busy={isPending}
            onClick={() => {
              if (!isAdded) {
                onAdd(dependency);
              }
            }}
          />
        </HStack>
      </HStack>
    </VStack>
  );
}
