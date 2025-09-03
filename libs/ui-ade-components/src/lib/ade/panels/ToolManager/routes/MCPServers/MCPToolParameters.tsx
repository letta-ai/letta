import {
  HStack,
  VStack,
  Typography,
  Badge,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { MCPToolInputSchema } from './types';

interface MCPToolParametersProps {
  inputSchema: MCPToolInputSchema;
}

export function MCPToolParameters({ inputSchema }: MCPToolParametersProps) {
  const t = useTranslations('ToolsEditor/MCPServers');
  if (
    !inputSchema.properties ||
    Object.keys(inputSchema.properties).length === 0
  ) {
    return null;
  }

  return (
    <VStack gap="medium" padding="small">
      <Typography variant="body2" underline bold>
        {t('TestMCPConnectionButton.parameters')}
      </Typography>
      <VStack gap="medium">
        {Object.entries(inputSchema.properties).map(([key, value]) => {
          const isRequired = inputSchema.required?.includes(key);
          return (
            <VStack key={key} gap="small" fullWidth>
              <HStack gap="medium" align="start">
                <Typography variant="body2" bold>
                  {key}
                </Typography>
                <Typography variant="body2" font="mono" color="muted">
                  {value.type || 'string'}
                </Typography>
                {isRequired && (
                  <Badge content="Required" size="small" variant="warning" />
                )}
              </HStack>
              {value.description && (
                <Typography variant="body2">{value.description}</Typography>
              )}
              {value.enum && (
                <Typography variant="body2" font="mono" color="muted">
                  {value.enum.join(', ')}
                </Typography>
              )}
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
