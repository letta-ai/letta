import * as React from 'react';

interface FullScreenDashboardPageLayoutProps {
  children: React.ReactNode;
}

export function FullScreenDashboardPageLayout(
  props: FullScreenDashboardPageLayoutProps,
) {
  const { children } = props;

  return (
    <div className="w-full pr-1 pt-1 encapsulated-full-height h-0 overflow-y-auto">
      {children}
    </div>
  );
}
