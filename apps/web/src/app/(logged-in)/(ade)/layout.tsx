import React from 'react';
import NextTopLoader from 'nextjs-toploader';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <>
      <NextTopLoader
        showSpinner={false}
        color="hsl(var(--brand))"
        zIndex={9999}
      />
      {children}
    </>
  );
}

export default Layout;
