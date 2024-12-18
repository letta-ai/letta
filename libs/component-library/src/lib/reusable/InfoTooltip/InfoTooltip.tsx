import * as React from 'react';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { InfoIcon } from '../../icons';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip(props: InfoTooltipProps) {
  const { text } = props;
  return (
    <Tooltip asChild content={text}>
      <span className="inline-flex">
        <InfoIcon color="muted" />
      </span>
    </Tooltip>
  );
}
