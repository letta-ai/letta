'use client';
import React, { useState, useEffect } from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  VStack,
  TabGroup,
  RawInput,
  SearchIcon,
  HStack,
  Button,
} from '@letta-cloud/ui-component-library';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';

import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { CloudProjectsList } from './_components/CloudProjectsList/CloudProjectsList';
import { CreateProjectDialog } from './_components/CreateProjectDialog/CreateProjectDialog';
import { SelfHostedProjectsList } from './_components/SelfHostedProjectsList/SelfHostedProjectsList';
import { ConnectToSelfHostedProjectDialog } from './_components/ConnectToSelfHostedProjectDialog/ConnectToSelfHostedProjectDialog';

type ProjectViewMode = 'cloud' | 'selfHosted';

function isProjectViewMode(mode: string): mode is ProjectViewMode {
  return mode === 'cloud' || mode === 'selfHosted';
}

interface ProjectsPageInnerProps {
  mode: ProjectViewMode;
  setMode: (mode: ProjectViewMode) => void;
}

function ProjectsPageInner(props: ProjectsPageInnerProps) {
  const { mode, setMode } = props;
  const t = useTranslations('projects/page.ProjectsPageInner');

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (mode) {
      setSearch('');
    }
  }, [mode]);

  return (
    <VStack>
      <TabGroup
        extendBorder
        value={mode}
        color="transparent"
        bold
        size="small"
        items={[
          {
            label: t('viewMode.cloud'),
            value: 'cloud',
          },
          {
            label: t('viewMode.selfHosted'),
            value: 'selfHosted',
          },
        ]}
        onValueChange={(mode) => {
          if (isProjectViewMode(mode)) {
            setMode(mode);
          }
        }}
      />
      <VStack>
        <HStack paddingY="small" fullWidth>
          <RawInput
            preIcon={<SearchIcon />}
            label={t('search')}
            className="max-w-[400px]"
            fullWidth
            placeholder={t('search')}
            value={search}
            hideLabel
            onChange={(e) => setSearch(e.target.value)}
          />
        </HStack>
        {mode === 'cloud' ? (
          <CloudProjectsList search={search} />
        ) : (
          <SelfHostedProjectsList search={search} />
        )}
      </VStack>
    </VStack>
  );
}

function ProjectsPage() {
  const t = useTranslations('projects/page');
  const searchParams = useSearchParams();
  const importDialogTriggerRef = React.useRef<HTMLButtonElement>(null);

  const targetAgentId = searchParams.get('import-agent');
  const defaultMode = searchParams.get('view-mode');

  const [mode, setMode] = useState<ProjectViewMode>(() => {
    if (defaultMode && isProjectViewMode(defaultMode)) {
      return defaultMode;
    }
    return 'cloud'; // Default to 'cloud' if no valid mode is provided
  });

  const {
    data: targetAgentfile,
    isError,
    isLoading,
  } = webApi.agentfile.getAgentfile.useQuery({
    queryData: {
      params: {
        agentId: targetAgentId!,
      },
    },
    queryKey: webApiQueryKeys.agentfile.getAgentfile(targetAgentId!),
    enabled: !!targetAgentId,
    retry: false,
  });

  useEffect(() => {
    if (targetAgentId && targetAgentfile?.body) {
      console.log(
        'Import agent ID found, opening import dialog:',
        targetAgentId,
      );
      // Programmatically trigger the dialog
      importDialogTriggerRef.current?.click();
    }
  }, [targetAgentId, targetAgentfile]);

  useEffect(() => {
    // Update the URL search params to reflect the current mode
    const url = new URL(window.location.href);
    url.searchParams.set('view-mode', mode);
    window.history.replaceState({}, '', url.toString());
  }, [mode]);

  if (isLoading) {
    return (
      <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
    );
  }

  if (isError) {
    return (
      <LoadingEmptyStatusComponent
        isError
        errorMessage={t('errorLoadingAgentfile')}
      />
    );
  }

  return (
    <>
      {targetAgentfile && (
        <ImportAgentsDialog
          showProjectSelector
          supportTemplateUploading
          trigger={
            <button
              ref={importDialogTriggerRef}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          }
          agentfileData={targetAgentfile.body}
        />
      )}
      <DashboardPageLayout
        title={t('title')}
        actions={
          mode === 'cloud' ? (
            <CreateProjectDialog
              trigger={
                <Button
                  data-testid="create-project-button"
                  color="secondary"
                  label={t('createProject')}
                />
              }
            />
          ) : (
            <ConnectToSelfHostedProjectDialog
              trigger={
                <Button color="secondary" label={t('connectToServer')} />
              }
            />
          )
        }
      >
        <DashboardPageSection>
          <ProjectsPageInner mode={mode} setMode={setMode} />
        </DashboardPageSection>
      </DashboardPageLayout>
    </>
  );
}

export default ProjectsPage;
