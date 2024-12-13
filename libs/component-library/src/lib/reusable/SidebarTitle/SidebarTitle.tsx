import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import type { AvatarProps } from '../../core/Avatar/Avatar';
import { Avatar } from '../../core/Avatar/Avatar';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { Typography } from '../../core/Typography/Typography';
import { useMemo } from 'react';
import { cn } from '@letta-web/core-style-config';

interface SidebarTitleProps {
  name: string;
  avatarSize?: AvatarProps['size'];
  variant?: 'default' | 'inline';
}

export function SidebarTitle(props: SidebarTitleProps) {
  const { name, avatarSize = 'large', variant } = props;

  const isInline = useMemo(() => {
    return variant === 'inline';
  }, [variant]);

  return (
    <div
      className={cn(
        'gap-2 justify-start w-full flex',
        isInline ? 'flex-row items-center' : 'flex-col'
      )}
    >
      <Avatar size={avatarSize} name={name} />
      <HStack fullWidth>
        <Tooltip asChild content={name}>
          <HStack collapseWidth overflow="hidden">
            <Typography bold fullWidth overflow="ellipsis" noWrap align="left">
              {name}
            </Typography>
          </HStack>
        </Tooltip>
      </HStack>
    </div>
  );
}
