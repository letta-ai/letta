import React from 'react';
import NextTopLoader from 'nextjs-toploader';
import { IntercomSetup } from '$web/client/components/IntercomSetup/IntercomSetup';
import './ADELayout.scss';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <>
      <div className="w-full h-full ade-transition-in">
        <NextTopLoader
          showSpinner={false}
          color="hsl(var(--brand))"
          zIndex={9999}
        />
        <IntercomSetup showLauncher={false} />
        {children}
      </div>
      <div className="ade-transition-out fixed top-0 left-0 h-full  w-full">
        <GoingToADEView noFadeIn={true} />
      </div>
    </>
  );
}

export default Layout;
