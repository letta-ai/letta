import type { Tool } from '@letta-cloud/sdk-core';
import type { IconWrapperProps } from '@letta-cloud/ui-component-library';
import {
  ComposioLogoMarkDynamic,
  LettaToolIcon,
  McpIcon,
  PythonIcon,
} from '@letta-cloud/ui-component-library';

interface SpecificToolIconProps {
  toolType: Tool['tool_type'];
  size?: IconWrapperProps['size'];
}

export function SpecificToolIcon(props: SpecificToolIconProps) {
  const { toolType, size } = props;

  switch (toolType) {
    case 'letta_memory_core':
    case 'letta_core':
    case 'letta_multi_agent_core':
    case 'letta_sleeptime_core':
    case 'letta_builtin':
    case 'letta_files_core':
      return <LettaToolIcon size={size} />;
    case 'external_composio':
      return <ComposioLogoMarkDynamic size={size} />;
    case 'external_mcp':
      return <McpIcon size={size} />;
    default:
      return <PythonIcon size={size} />;
  }
}
