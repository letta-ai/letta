'use client';
import React from 'react';
import {
  Button,
} from '@letta-cloud/ui-component-library';
import {
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useRouter } from 'next/navigation';
import { DeployAgentDialog } from './DeployAgentDialog/DeployAgentDialog';
import {
  ImportAgentsDialog,
} from '@letta-cloud/ui-ade-components';
import { AgentsList } from './_components/AgentsList/AgentsList';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';

function DeployedAgentsPage() {

  const { slug: currentProjectSlug, id: currentProjectId } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/agents/page');


  const { push } = useRouter();

  return (
    <DashboardPageLayout
      actions={
        <HStack>
          <ImportAgentsDialog
            onSuccess={(id, isTemplate) => {
              if (isTemplate) {
                push(`/projects/${currentProjectSlug}/templates/${id}`);
                return;
              }
              push(`/projects/${currentProjectSlug}/agents/${id}`);
            }}
            supportTemplateUploading
            projectId={currentProjectId}
            trigger={
              <Button label={t('importAgents.title')} color="secondary" />
            }
          />
          <DeployAgentDialog />
        </HStack>
      }
      encapsulatedFullHeight
      title={t('pageTitle')}
    >
      <DashboardPageSection fullHeight>
        <AgentsList />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DeployedAgentsPage;
