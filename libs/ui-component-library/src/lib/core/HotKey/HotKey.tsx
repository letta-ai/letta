import * as React from 'react';
import { Typography } from '../Typography/Typography';
import { useMemo } from 'react';
import { HStack } from '../../framing/HStack/HStack';

interface HotKeyProps {
  command: string;
}

export function HotKey(props: HotKeyProps) {
  const { command } = props;

  const transformedCommand = useMemo(() => {
    // replace "mod" with "ctrl" or "⌘" based on the platform
    // replace shift with "⇧" and alt with "⌥"
    return command
      .replace('mod', navigator.platform.includes('Mac') ? '⌘' : 'ctrl')
      .replace('shift', '⇧')
      .replace('alt', '⌥')
      .replace(/\+/g, '');
  }, [command]);

  return (
    <HStack className="rounded-sm px-1" color="background-grey">
      <Typography uppercase color="muted" variant="body4">
        {transformedCommand}
      </Typography>
    </HStack>
  );
}
