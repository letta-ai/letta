import type { Tool } from '@letta-cloud/sdk-core';
import type { IconWrapperProps } from '@letta-cloud/ui-component-library';
import {
  ComposioLogoMarkDynamic,
  LettaToolIcon,
  McpIcon,
  PythonIcon,
  TypescriptIcon,
} from '@letta-cloud/ui-component-library';
import { isLettaTool } from '@letta-cloud/sdk-core';

interface SpecificToolIconProps {
  toolType: Tool['tool_type'];
  sourceType?: Tool['source_type'];
  size?: IconWrapperProps['size'];
}

export function SpecificToolIcon(props: SpecificToolIconProps) {
  const { toolType, sourceType, size } = props;

  if (isLettaTool(toolType)) {
    return <LettaToolIcon size={size} />;
  }

  switch (toolType) {
    case 'external_composio':
      return <ComposioLogoMarkDynamic size={size} />;
    case 'external_mcp':
      return <McpIcon size={size} />;
    case 'custom':
      // For custom tools, check the source type
      // Check for both 'typescript' and 'TypeScript' to handle potential casing issues
      if (sourceType === 'typescript' || sourceType === 'TypeScript') {
        return <TypescriptIcon size={size} />;
      }
      return <PythonIcon size={size} />;
    default:
      return <PythonIcon size={size} />;
  }
}
