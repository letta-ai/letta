import React from 'react';
import NextTopLoader from 'nextjs-toploader';
import { IntercomSetup } from '$web/client/components/IntercomSetup/IntercomSetup';

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
      <IntercomSetup showLauncher={false} />
      {children}
    </>
  );
}

export default Layout;
