'use client';
import React from 'react';
import { Button } from '@letta-cloud/ui-component-library';
import {
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useRouter } from 'next/navigation';
import { DeployAgentDialog } from './DeployAgentDialog/DeployAgentDialog';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';
import { AgentsList } from './_components/AgentsList/AgentsList';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';

function DeployedAgentsPage() {
  const {
    slug: currentProjectSlug,
    id: currentProjectId,
    name: projectName,
  } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const { push } = useRouter();

  return (
    <DashboardPageLayout
      actions={
        <HStack>
          {currentProjectId && (
            <ImportAgentsDialog
              onSuccess={(id, isTemplate) => {
                if (isTemplate) {
                  push(`/projects/${currentProjectSlug}/templates/${id}`);
                  return;
                }
                push(`/projects/${currentProjectSlug}/agents/${id}`);
              }}
              supportTemplateUploading
              defaultProject={
                currentProjectId
                  ? {
                      id: currentProjectId,
                      name: projectName,
                      slug: currentProjectSlug,
                    }
                  : undefined
              }
              showProjectSelector
              trigger={
                <Button data-testid="import-agents-button" label={t('importAgents.title')} color="secondary" />
              }
            />
          )}
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
