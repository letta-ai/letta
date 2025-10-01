import { useCurrentAgent, useCurrentAgentMetaData } from '../../../hooks';
import { VStack } from '@letta-cloud/ui-component-library';

import { MessageBufferAutoclearSwitch } from '../../inputs/MessageBufferAutoclearSwitch/MessageBufferAutoclearSwitch';
import { AgentType } from './components/AgentType/AgentType';
import { MessageBufferLengthSlider } from '../../inputs/MessageBufferLengthSlider/MessageBufferLengthSlider';
import { SleeptimeAgentFrequencyInput } from '../../inputs/SleeptimeAgentFrequencyInput/SleeptimeAgentFrequencyInput';
import { MaxFilesInput } from '../../inputs/MaxFilesInput/MaxFilesInput';
import { WindowCharLimitInput } from '../../inputs/WindowCharLimitInput/WindowCharLimitInput';

export function SharedAdvancedSettings() {
  const { agentType, isSleeptimeAgent } = useCurrentAgentMetaData();
  const currentAgent = useCurrentAgent();
  if (!currentAgent?.id) {
    return null;
  }

  return (
    <VStack>
      <VStack gap="large">
        <AgentType />
        <MessageBufferAutoclearSwitch />
        {currentAgent.max_files_open && <MaxFilesInput defaultValue={currentAgent.max_files_open.toString() || ''}  />}
        {currentAgent.per_file_view_window_char_limit && <WindowCharLimitInput defaultValue={currentAgent.per_file_view_window_char_limit?.toString() || ''} />}
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
