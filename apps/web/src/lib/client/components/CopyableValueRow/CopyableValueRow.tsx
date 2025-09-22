import React from 'react';
import {
  HStack,
  Typography,
  Button,
  Tooltip,
  EyeClosedIcon,
  EyeOpenIcon,
} from '@letta-cloud/ui-component-library';
import { useCopyToClipboard } from '@letta-cloud/ui-component-library';

interface CopyableValueRowProps {
  value: string;
  tooltip?: string;
  showVisibilityToggle?: boolean;
  maskedDisplay?: string | ((value: string) => string);
  testId?: string;
}

export function CopyableValueRow(props: CopyableValueRowProps) {
  const { value, tooltip, showVisibilityToggle, maskedDisplay, testId } = props;
  const { copyToClipboard } = useCopyToClipboard({ textToCopy: value || '' });
  const [show, setShow] = React.useState(!showVisibilityToggle);

  const display = React.useMemo(() => {
    if (show) return value || '';
    if (!maskedDisplay) return '••••••••';
    return typeof maskedDisplay === 'function' ? maskedDisplay(value || '') : maskedDisplay;
  }, [maskedDisplay, show, value]);

  const Row = (
    <HStack
      data-testid={testId}
      color="background-grey2"
      border
      paddingLeft="xsmall"
      paddingRight="xsmall"
      align="center"
      className="border-background-grey2-border dark:border-background-grey3-border hover:bg-background-grey3 transition-colors cursor-pointer min-w-0 h-8"
      fullWidth
      overflowX="hidden"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard();
      }}
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        <Typography
          className="font-mono text-xs truncate block leading-none"
          color="lighter"
          variant="body3"
          overrideEl="span"
          overflow="ellipsis"
          noWrap
          fullWidth
        >
          {display}
        </Typography>
      </div>
      {showVisibilityToggle && (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            color="tertiary"
            size="xsmall"
            hideLabel
            _use_rarely_disableTooltip
            _use_rarely_className="hover:bg-transparent hover:text-current"
            preIcon={show ? <EyeClosedIcon /> : <EyeOpenIcon />}
            onClick={() => setShow((prev) => !prev)}
          />
        </div>
      )}
    </HStack>
  );

  if (tooltip) {
    return (
      <Tooltip asChild content={tooltip} placement="top">
        {Row}
      </Tooltip>
    );
  }

  return Row;
}
