import type { Tool } from '@letta-cloud/sdk-core';
import {
  ComposioLogoMarkDynamic,
  LettaLogoIcon,
  McpIcon,
  PythonIcon,
} from '@letta-cloud/ui-component-library';

interface SpecificToolIconProps {
  toolType: Tool['tool_type'];
}

export function SpecificToolIcon(props: SpecificToolIconProps) {
  const { toolType } = props;

  switch (toolType) {
    case 'letta_memory_core':
    case 'letta_core':
    case 'letta_multi_agent_core':
      return <LettaLogoIcon />;
    case 'external_composio':
      return <ComposioLogoMarkDynamic />;
    case 'external_mcp':
      return <McpIcon />;
    default:
      return <PythonIcon />;
  }
}
