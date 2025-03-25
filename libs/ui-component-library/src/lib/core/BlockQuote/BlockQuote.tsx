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
    return cn('border-l-2 pl-2', fullWidth ? 'w-full' : 'w-fit');
  }, [fullWidth]);
  return <div className={className}>{children}</div>;
}
