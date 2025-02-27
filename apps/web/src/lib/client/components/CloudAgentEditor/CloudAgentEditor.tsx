'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Alert,
  Frame,
  HiddenOnMobile,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/component-library';
import {
  ADELayout,
  useCurrentAgentMetaData,
} from '@letta-cloud/shared-ade-components';
import React, { useMemo, useState } from 'react';
import { useCurrentProject } from '../../hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';

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
  const { id: projectId } = useCurrentProject();
  const { isTemplate, isLocal } = useCurrentAgentMetaData();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const fullPageWarning = useMemo(() => {
    if (isLocal) {
      return t('localAgentDevelopment');
    }

    if (!isTemplate) {
      return t('liveAgentWarning');
    }

    return null;
  }, [isLocal, isTemplate, t]);

  const user = useCurrentUser();

  return (
    <ADEPage>
      <HiddenOnMobile>
        <VStack overflow="hidden" position="relative" fullWidth fullHeight>
          {fullPageWarning && (
            <Alert variant="warning" title={fullPageWarning} />
          )}
          <Frame overflow="hidden" position="relative" fullWidth fullHeight>
            <HiddenOnMobile checkWithJs>
              <ADELayout user={user} projectId={projectId} />
            </HiddenOnMobile>
          </Frame>
        </VStack>
      </HiddenOnMobile>
      <VisibleOnMobile>
        <MobileNavigationProvider>
          <VStack fullHeight fullWidth flex>
            <VisibleOnMobile checkWithJs>
              <ADELayout user={user} projectId={projectId} />
            </VisibleOnMobile>
          </VStack>
        </MobileNavigationProvider>
      </VisibleOnMobile>
    </ADEPage>
  );
}
