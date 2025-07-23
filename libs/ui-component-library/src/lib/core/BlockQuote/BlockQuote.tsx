import * as React from 'react';

import { cn } from '@letta-cloud/ui-styles';
import { useMemo } from 'react';

interface BlockQuoteProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function BlockQuote(props: BlockQuoteProps) {
  const { children, fullWidth } = props;
  const className = useMemo(() => {
    return cn(
      'border-l-[3px] border-border-violet pl-3 pr-2 py-3 bg-background-violet rounded-[2px]',
      fullWidth ? 'w-full' : 'w-fit',
    );
  }, [fullWidth]);
  return <div className={className}>{children}</div>;
}
