import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Avatar } from '../../core/Avatar/Avatar';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { Typography } from '../../core/Typography/Typography';

interface SidebarTitleProps {
  name: string;
}

export function SidebarTitle(props: SidebarTitleProps) {
  const { name } = props;

  return (
    <HStack fullWidth align="center" justify="start">
      <Avatar size="medium" name={name} />
      <Tooltip asChild content={name}>
        <HStack collapseWidth overflow="hidden">
          <Typography fullWidth overflow="ellipsis" noWrap align="left">
            {name}
          </Typography>
        </HStack>
      </Tooltip>
    </HStack>
  );
}
