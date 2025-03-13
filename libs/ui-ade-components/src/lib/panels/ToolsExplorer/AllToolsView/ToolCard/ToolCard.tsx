import type { ToolType } from '@letta-cloud/sdk-core';
import {
  Button,
  ComposioLogoMarkDynamic,
  HStack,
  LettaLogoMarkDynamic,
  ToolsIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface ToolIconProps {
  type: ToolType;
}

function ToolIconRenderer(props: ToolIconProps) {
  const { type } = props;

  switch (type) {
    case 'letta_memory_core':
    case 'letta_core':
    case 'letta_multi_agent_core':
      return <LettaLogoMarkDynamic size="xsmall" />;
    case 'external_composio':
      return <ComposioLogoMarkDynamic />;
    default:
      return <ToolsIcon />;
  }
}

interface ToolCardProps {
  name: string;
  id: string;
  type: ToolType;
  description?: string | null;
  onSelect?: () => void;
}

export function ToolCard(props: ToolCardProps) {
  const { name, id, type, description, onSelect } = props;

  const t = useTranslations('ToolCard');
  return (
    <HStack align="start" color="background-grey" padding="small" key={id}>
      <VStack fullWidth>
        <HStack justify="spaceBetween">
          <HStack collapseWidth flex>
            <HStack
              overflow="hidden"
              align="center"
              color="brand-light"
              paddingX="xxsmall"
              gap="small"
            >
              <HStack align="center" justify="center" className="w-[16px]">
                <ToolIconRenderer type={type} />
              </HStack>
              <Typography
                noWrap
                overflow="ellipsis"
                as="span"
                font="mono"
                variant="body2"
              >
                {name}
                {type !== 'external_composio' && '.py'}
              </Typography>
            </HStack>
          </HStack>
          <Button
            onClick={onSelect}
            color="tertiary"
            size="small"
            bold
            label={t('select')}
          />
        </HStack>
        <div className="line-clamp-2">
          <Typography variant="body">{description}</Typography>
        </div>
      </VStack>
    </HStack>
  );
}
