import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Avatar } from '../../core/Avatar/Avatar';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';

interface SidebarTitleProps {
  name: string;
}

export function SidebarTitle(props: SidebarTitleProps) {
  const { name } = props;

  return (
    <VStack paddingX="xsmall" fullWidth align="start" justify="start">
      <Avatar size="large" name={name} />
      <HStack fullWidth>
        <Tooltip asChild content={name}>
          <HStack collapseWidth overflow="hidden">
            <Typography bold fullWidth overflow="ellipsis" noWrap align="left">
              {name}
            </Typography>
          </HStack>
        </Tooltip>
      </HStack>
    </VStack>
  );
}
