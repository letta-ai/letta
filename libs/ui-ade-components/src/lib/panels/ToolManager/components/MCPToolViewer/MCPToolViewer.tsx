import { useMemo } from 'react';
import {
  Alert,
  HStack,
  McpIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import { useTranslations } from '@letta-cloud/translations';

interface MCPToolViewerProps {
  tags: string[];
  name: string;
  description: string;
  attachedId: string;
}

interface MCPToolContentProps {
  serverName?: string;
  description: string;
  name: string;
}

function MCPToolContent(props: MCPToolContentProps) {
  const { serverName, description, name } = props;

  const t = useTranslations('ToolManager/MCPToolViewer');

  if (!serverName) {
    return <Alert title={t('noServerFound')} />;
  }

  return (
    <VStack fullWidth padding>
      <HStack align="center" justify="spaceBetween">
        <HStack gap="large" align="center">
          <HStack
            color="background-grey"
            className="w-[64px] h-[64px]"
            align="center"
            justify="center"
          >
            <McpIcon />
          </HStack>
          <VStack gap={false}>
            <Typography>{name}</Typography>
            <Typography>{serverName}</Typography>
          </VStack>
        </HStack>
      </HStack>
      <VStack width="contained">
        <Typography>{description}</Typography>
      </VStack>
    </VStack>
  );
}

export function MCPToolViewer(props: MCPToolViewerProps) {
  const { tags, attachedId, name, description } = props;

  const serverName = useMemo(() => {
    return tags.find((tag) => tag.startsWith('mcp:'))?.split(':')[1];
  }, [tags]);

  return (
    <VStack gap={false}>
      <ToolActionsHeader
        idToAttach={`${serverName}:${attachedId}`}
        attachedId={attachedId}
        type="external_mcp"
        name={name}
      />
      <MCPToolContent
        serverName={serverName}
        description={description}
        name={name}
      />
    </VStack>
  );
}
