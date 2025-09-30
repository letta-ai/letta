import { PanelMainContent, VStack } from '@letta-cloud/ui-component-library';
import { AgentDescription } from '../../inputs/AgentDescription/AgentDescription';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';
import { SharedAdvancedSettings } from '../SharedAdvancedSettings/SharedAdvancedSettings';

function AgentAdvancedSettingsView() {

  return (
    <VStack gap="large">
      {/* Metadata Section */}
      <VStack>
        <AgentTags />
        <AgentDescription />
      </VStack>

      <SharedAdvancedSettings />
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
