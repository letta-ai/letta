import * as React from 'react';

interface BlockQuoteProps {
  children: React.ReactNode;
}

export function BlockQuote(props: BlockQuoteProps) {
  const { children } = props;
  return <div className="border-l-2 pl-2">{children}</div>;
}
