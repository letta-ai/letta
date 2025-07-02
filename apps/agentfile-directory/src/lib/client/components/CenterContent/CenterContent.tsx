import React from 'react';

interface CenterContentProps {
  children: React.ReactNode;
}

export function CenterContent(props: CenterContentProps) {
  const { children } = props;

  return <div className="max-w-[1024px] px-6 w-full mx-auto">{children}</div>;
}
