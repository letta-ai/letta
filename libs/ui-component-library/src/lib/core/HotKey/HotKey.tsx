import * as React from 'react';
import { Typography } from '../Typography/Typography';
import { useMemo } from 'react';

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
    <Typography uppercase color="muted" variant="body3">
      {transformedCommand}
    </Typography>
  );
}
