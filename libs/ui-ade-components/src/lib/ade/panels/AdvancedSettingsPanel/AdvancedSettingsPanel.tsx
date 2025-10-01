import { PanelMainContent, VStack, Typography } from '@letta-cloud/ui-component-library';
import { SharedAdvancedSettings } from '../SharedAdvancedSettings/SharedAdvancedSettings';
import { EmbeddingConfiguration } from '../../inputs/EmbeddingConfiguration/EmbeddingConfiguration';
import { useTranslations } from '@letta-cloud/translations';

function AgentAdvancedSettingsView() {
  const tLayout = useTranslations('ADELayout');
  const tAdvanced = useTranslations('ADE/AdvancedAgentTemplateSettingsPanel');
  return (
    <VStack gap="large">
      <Typography bold variant="body3">
        {tAdvanced('advanced')}
      </Typography>
      <SharedAdvancedSettings />
      <EmbeddingConfiguration label={tLayout('embeddingConfig')} />
    </VStack>
  );
}

export function AdvancedSettingsPanel() {
  return (
    <PanelMainContent>
      <AgentAdvancedSettingsView />
    </PanelMainContent>
  );
}
