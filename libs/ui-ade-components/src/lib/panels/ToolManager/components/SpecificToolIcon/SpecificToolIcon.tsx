import type { Tool } from '@letta-cloud/sdk-core';
import type { IconWrapperProps } from '@letta-cloud/ui-component-library';
import {
  ComposioLogoMarkDynamic,
  LettaToolIcon,
  McpIcon,
  PythonIcon,
} from '@letta-cloud/ui-component-library';
import { isLettaTool } from '@letta-cloud/sdk-core';

interface SpecificToolIconProps {
  toolType: Tool['tool_type'];
  size?: IconWrapperProps['size'];
}

export function SpecificToolIcon(props: SpecificToolIconProps) {
  const { toolType, size } = props;

  if (isLettaTool(toolType)) {
    return <LettaToolIcon size={size} />;
  }

  switch (toolType) {
    case 'external_composio':
      return <ComposioLogoMarkDynamic size={size} />;
    case 'external_mcp':
      return <McpIcon size={size} />;
    default:
      return <PythonIcon size={size} />;
  }
}
