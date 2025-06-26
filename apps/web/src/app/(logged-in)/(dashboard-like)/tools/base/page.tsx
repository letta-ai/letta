import { LettaTools } from '@letta-cloud/ui-ade-components';

export default function BaseToolsPage() {
  return (
    <LettaTools
      types={['letta_memory_core', 'letta_core', 'letta_sleeptime_core']}
    />
  );
}
