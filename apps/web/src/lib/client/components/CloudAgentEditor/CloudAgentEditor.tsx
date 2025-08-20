'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Frame,
  HiddenOnMobile,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ADELayout } from '@letta-cloud/ui-ade-components';
import React, { useState } from 'react';

interface MobileNavigationContextData {
  activePanel: string | null;
  setActivePanelId: (panelId: string | null) => void;
}

const MobileNavigationContext =
  React.createContext<MobileNavigationContextData>({
    activePanel: null,
    setActivePanelId: () => {
      return;
    },
  });

interface MobileNavigationProviderProps {
  children: React.ReactNode;
}

function MobileNavigationProvider(props: MobileNavigationProviderProps) {
  const [activePanel, setActivePanelId] = useState<string | null>(
    'agent-simulator',
  );

  const { children } = props;

  return (
    <MobileNavigationContext.Provider value={{ activePanel, setActivePanelId }}>
      {children}
    </MobileNavigationContext.Provider>
  );
}

export function CloudAgentEditor() {


  return (
    <ADEPage>
      <HiddenOnMobile>
        <VStack overflow="hidden" position="relative" fullWidth fullHeight>
          <Frame overflow="hidden" position="relative" fullWidth fullHeight>
            <HiddenOnMobile checkWithJs>
              <ADELayout  />
            </HiddenOnMobile>
          </Frame>
        </VStack>
      </HiddenOnMobile>
      <VisibleOnMobile>
        <MobileNavigationProvider>
          <VStack fullHeight fullWidth flex>
            <VisibleOnMobile checkWithJs>
              <ADELayout />
            </VisibleOnMobile>
          </VStack>
        </MobileNavigationProvider>
      </VisibleOnMobile>
    </ADEPage>
  );
}
