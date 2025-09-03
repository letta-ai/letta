import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  VStack,
  Typography,
  Popover,
  ChevronDownIcon,
} from '@letta-cloud/ui-component-library';
import type { MCPTool } from './types';
import { MCPToolParameters } from './MCPToolParameters';

interface MCPToolsListProps {
  tools: MCPTool[];
}

export function MCPToolsList({ tools }: MCPToolsListProps) {
  const t = useTranslations('ToolsEditor/MCPServers');

  if (tools.length === 0) {
    return null;
  }

  return (
    <VStack fullWidth gap="medium" padding="small">
      <Typography variant="body2" color="muted">
        {t('TestMCPConnectionButton.availableTools')} ({tools.length})
      </Typography>
      <VStack gap="medium">
        {tools.map((tool, index) => (
          <HStack key={tool.name || index} fullWidth>
            {tool.description ? (
              <Popover
                triggerAsChild
                align="center"
                className="w-[350px]"
                trigger={
                  <Button
                    label={tool.name}
                    color="tertiary"
                    fullWidth
                    align="left"
                    size="small"
                    preIcon={<ChevronDownIcon />}
                  />
                }
              >
                <VStack fullWidth>
                  <VStack gap="small" padding="small">
                    <VStack padding="small">
                      <Typography variant="body2" underline bold>
                        {t('TestMCPConnectionButton.description')}
                      </Typography>
                      <Typography variant="body2">
                        {tool.description}
                      </Typography>
                    </VStack>
                    {tool.inputSchema && (
                      <MCPToolParameters inputSchema={tool.inputSchema} />
                    )}
                  </VStack>
                </VStack>
              </Popover>
            ) : (
              <Typography variant="body3">{tool.name}</Typography>
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
