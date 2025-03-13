import React from 'react';
import {
  CloseIcon,
  CloseMiniApp,
  HStack,
} from '@letta-cloud/ui-component-library';

interface ToolAppHeaderProps {
  children: React.ReactNode;
  borderBottom?: boolean;
}

export function ToolAppHeader(props: ToolAppHeaderProps) {
  const { children, borderBottom } = props;
  return (
    <HStack
      height="header"
      borderBottom={borderBottom}
      align="center"
      justify="spaceBetween"
      paddingX="medium"
      fullWidth
    >
      <HStack gap={false}>{children}</HStack>
      <CloseMiniApp data-testid="close-tool-explorer">
        <HStack>
          <CloseIcon />
        </HStack>
      </CloseMiniApp>
    </HStack>
  );
}
