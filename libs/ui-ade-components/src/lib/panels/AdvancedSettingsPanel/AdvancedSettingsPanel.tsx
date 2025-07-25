import { useCurrentAgentMetaData } from '../../hooks';
import { PanelMainContent, VStack } from '@letta-cloud/ui-component-library';

import { MessageBufferAutoclearSwitch } from './components/MessageBufferAutoclearSwitch/MessageBufferAutoclearSwitch';
import { AgentType } from './components/AgentType/AgentType';
import { MessageBufferLengthSlider } from './components/MessageBufferLengthSlider/MessageBufferLengthSlider';
import { SleeptimeAgentFrequencyInput } from './components/SleeptimeAgentFrequencyInput/SleeptimeAgentFrequencyInput';
import { MaxFilesInput } from './components/MaxFilesInput/MaxFilesInput';
import { WindowCharLimitInput } from './components/WindowCharLimitInput/WindowCharLimitInput';

function AgentAdvancedSettingsView() {
  const { agentType, isSleeptimeAgent } = useCurrentAgentMetaData();

  return (
    <VStack gap="large">
      <VStack>
        <AgentType />
        <MessageBufferAutoclearSwitch />
        <MaxFilesInput />
        <WindowCharLimitInput />
      </VStack>
      <VStack gap="xlarge">
        {agentType === 'voice_convo_agent' && <MessageBufferLengthSlider />}
        {isSleeptimeAgent && agentType !== 'voice_convo_agent' && (
          <SleeptimeAgentFrequencyInput />
        )}
      </VStack>
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
