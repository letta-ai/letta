import {
  Button,
  CoreMemoryEditor,
  EmptyBlockIcon,
  LinkIcon, LoadingEmptyStatusComponent,
  MemoryBlocksIcon,
  type MemoryType,
  PlusIcon,
  SplitscreenRightIcon,
  TabGroup,
  Typography,
  useVisibleMemoryTypeContext,
  VisibleMemoryTypeProvider
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '../../../OnboardingAsideFocus/OnboardingAsideFocus';

import { InfoTooltip } from '@letta-cloud/ui-component-library';
import { LettaLoaderPanel } from '@letta-cloud/ui-component-library';
import { HStack } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { PanelMainContent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../hooks';
import { useState } from 'react';
import React, { useMemo } from 'react';
import { useSortedMemories } from '@letta-cloud/utils-client';
import { useCurrentAgentMetaData } from '../../../hooks';
import {
  AdvancedCoreMemoryEditor,
  useAdvancedCoreMemoryEditor,
} from './AdvancedCoreMemoryEditor';
import { useADEPermissions } from '../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADETour } from '../../../hooks/useADETour/useADETour';
import './EditCoreMemoriesPanel.css';
import type { Block } from '@letta-cloud/sdk-core';
import { isAgentState } from '@letta-cloud/sdk-core';
import { CreateNewMemoryBlockDialog } from './CreateNewMemoryBlockDialog/CreateNewMemoryBlockDialog';
import { useQuickADETour } from '../../../hooks/useQuickADETour/useQuickADETour';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { AttachMemoryBlockDialog } from './AttachMemoryBlockDialog/AttachMemoryBlockDialog';
import { useSharedAgents } from '../../../hooks/useSharedAgents/useSharedAgents';
import { useUpdateMemoryBlock } from '../../../hooks/useUpdateMemoryBlock/useUpdateMemoryBlock';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useListMemories } from '../../../hooks/useListMemories';

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  memoryType: MemoryType;
  disabled?: boolean;
  hasSimulatedDiff?: boolean;
  minimal?: boolean;
  templateId?: string;
  agentId?: string;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const {
    label,
    templateId,
    memory,
    agentId,
    memoryType,
    minimal,
    hasSimulatedDiff,
    disabled,
  } = props;

  const { isTemplate } = useCurrentAgentMetaData();

  const sharedAgents = useSharedAgents(memory.id || '');

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const { open } = useAdvancedCoreMemoryEditor();

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const { handleUpdate, isPending, isError } = useUpdateMemoryBlock({
    label,
    memoryType,
    blockId: memory.id,
    agentId,
    templateId,
  });

  return (
    <CoreMemoryEditor
      memoryBlock={{
        ...memory,
      }}
      openInAdvanced={
        memoryType === 'agent' && isTemplate
          ? undefined
          : () => {
              open(label);
            }
      }
      showDiff
      hideHeaderChips={minimal}
      greyOutDisabledTextArea={minimal}
      hideDescription={minimal}
      hasSimulatedDiff={hasSimulatedDiff}
      sharedAgents={sharedAgents}
      isSaving={isPending}
      testId={`edit-memory-block-${label}-content`}
      errorMessage={isError ? t('error') : ''}
      disabled={!canUpdateAgent || disabled}
      onSave={(value) => {
        handleUpdate({
          value,
        });
      }}
    />
  );
}

interface MemoryWrapperProps {
  children: React.ReactNode;
  memoryCount: number;
}

function MemoryWrapper(props: MemoryWrapperProps) {
  const { children, memoryCount } = props;

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const {  memory } = useCurrentAgent();

  if (!memory) {
    return (
      <LoadingEmptyStatusComponent isLoading loaderVariant="grower" emptyMessage="" hideText />
    )
  }

  if (memoryCount === 0) {
    return (
      <VStack
        align="center"
        justify="center"
        fullWidth
        paddingTop="xxsmall"
        fullHeight
        border="dashed"
      >
        <VStack paddingBottom="small" align="center">
          <VStack paddingY="small">
            <EmptyBlockIcon size="xlarge" />
          </VStack>
          <Typography color="lighter" variant="body2">
            {t('MemoryWrapper.emptyMemoryBlock')}
          </Typography>
        </VStack>
        <CreateNewMemoryBlockDialog
          trigger={
            <Button
              preIcon={<PlusIcon />}
              bold
              label={t('MemoryWrapper.addMemory')}
              color="secondary"
              size="small"
            />
          }
        />
        <AttachMemoryBlockDialog
          trigger={
            <Button
              preIcon={<LinkIcon />}
              label={t('MemoryWrapper.attachMemory')}
              color="tertiary"
              size="small"
            />
          }
        />
      </VStack>
    );
  }

  return (
    <VStack paddingTop="xxsmall" fullHeight gap="medium">
      {children}
    </VStack>
  );
}

function TemplateMemory() {
  const { templateId, isTemplate } = useCurrentAgentMetaData();
  const agent = useCurrentAgent();
  const { data: blockTemplates } =
    webApi.blockTemplates.getAgentTemplateBlockTemplates.useQuery({
      queryData: {
        params: { agentTemplateId: templateId || '' },
      },
      queryKey: webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
        templateId || '',
      ),
      enabled: !!(isTemplate && templateId),
    });

  const blockTemplateList = useMemo(() => {
    return blockTemplates?.body?.blockTemplates || [];
  }, [blockTemplates]);

  const simulatedMemoriesLabelMap = useMemo(() => {
    const map = new Map<string, Block>();

    if (!isAgentState(agent)) {
      return map;
    }

    agent.memory.blocks.forEach((block) => {
      if (block.label) {
        map.set(block.label, block);
      }
    });

    return map;
  }, [agent]);

  const memories = useMemo(() => {
    return blockTemplateList.toSorted((a, b) => {
      return a.label.localeCompare(b.label || '') || 0;
    });
  }, [blockTemplateList]);

  if (!blockTemplates?.body?.blockTemplates) {
    return (
      <VStack paddingTop="xxsmall" fullHeight gap="medium">
        <LettaLoaderPanel />
      </VStack>
    );
  }

  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block) => {
        const simulatedBlock = simulatedMemoriesLabelMap.get(block.label || '');
        const hasSimulatedDiff =
          simulatedBlock && simulatedBlock.value !== block.value;

        return (
          <EditMemoryForm
            key={`${block.label}_template`}
            memory={block}
            memoryType="templated"
            agentId={agent.id}
            templateId={templateId}
            hasSimulatedDiff={hasSimulatedDiff}
            label={block.label || ''}
          />
        );
      })}
    </MemoryWrapper>
  );
}

interface SimulatedMemoryProps {
  minimal?: boolean;
}

function AgentMemory(props: SimulatedMemoryProps) {
  const { minimal } = props;
  const agent = useCurrentAgent();

  const { isTemplate } = useCurrentAgentMetaData();

  const memories = useSortedMemories(agent);

  if (!agent) {
    return (
      <VStack paddingTop="xxsmall" fullHeight gap="medium">
        <LettaLoaderPanel />
      </VStack>
    );
  }

  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block, index) => (
        <EditMemoryForm
          key={`${block.label}_${index}`}
          disabled={isTemplate}
          memory={block}
          agentId={agent.id}
          minimal={minimal}
          memoryType="agent"
          label={block.label || ''}
        />
      ))}
    </MemoryWrapper>
  );
}

interface MemoryOnboardingProps {
  children: React.ReactNode;
}

function MemoryOnboarding(props: MemoryOnboardingProps) {
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { children } = props;

  const { currentStep, setStep } = useADETour();

  if (currentStep !== 'core_memories') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('MemoryOnboarding.title')}
      placement="left-start"
      description={t('MemoryOnboarding.description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          fullWidth
          size="large"
          bold
          onClick={() => {

            setStep('tools');
          }}
          label={t('MemoryOnboarding.next')}
        />
      }
      currentStep={2}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

interface QuickMemoryOnboardingProps {
  children: React.ReactNode;
}

function QuickMemoryOnboarding(props: QuickMemoryOnboardingProps) {
  const t = useTranslations('ADE/EditCoreMemoriesPanel.QuickOnboarding');
  const { children } = props;

  const { currentStep, setStep } = useQuickADETour();

  if (currentStep !== 'memory') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('title')}
      placement="left-start"
      description={t('description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          data-testid="onboarding-next-to-tools"
          fullWidth
          size="large"
          bold
          onClick={() => {
            trackClientSideEvent(
              AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED,
              {
                onboarding_step: 'view_core_memory_panel',
                onboarding_type: 'create:new_agent',
              },
            );

            document.getElementById('ade-tab-header-tools')?.click();


            setStep('tools');
          }}
          label={t('next')}
        />
      }
      currentStep={3}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function AdvancedEditorButton() {
  const { open, close, isOpen } = useAdvancedCoreMemoryEditor();
  const agent = useCurrentAgent();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { isTemplate, templateId } = useCurrentAgentMetaData();

  const { memories, isNotLoaded } = useListMemories({
    memoryType: isTemplate ? 'templated' : 'agent',
    agentId: isTemplate ? undefined : agent.id,
    templateId: isTemplate ? templateId : undefined,
  });

  const firstLabel = useMemo(() => {
    return memories?.[0]?.label;
  }, [memories]);

  if (isNotLoaded) {
    return null;
  }

  return (
    <HStack
      fullHeight
      paddingTop="xxsmall"
      paddingBottom="xxsmall"
      className="h-[34px]"
      align="center"
      position="relative"
      justify="end"
    >
      <Button
        color="secondary"
        size="xsmall"
        bold
        hideLabelOnSmallPanel
        preIcon={<MemoryBlocksIcon />}
        data-testid="open-advanced-memory-editor"
        label={t('advancedEditor')}
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }

          open(firstLabel || undefined);
        }}
      />
    </HStack>
  );
}

function MemoryTabs() {
  const { visibleMemoryType, setVisibleMemoryType } =
    useVisibleMemoryTypeContext();
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  return (
    <TabGroup
      color="transparent"
      bold
      border={false}
      size="xsmall"
      value={visibleMemoryType}
      onValueChange={(value) => {
        if (!value) {
          return;
        }

        setVisibleMemoryType(value as MemoryType);
      }}
      items={
        isTemplate
          ? [
              {
                label: t('toggleMemoryType.templated.label'),
                value: 'templated',
                postIcon: (
                  <InfoTooltip text={t('toggleMemoryType.templated.tooltip')} />
                ),
              },
              {
                label: t('toggleMemoryType.simulated.label'),
                value: 'agent',
                postIcon: (
                  <InfoTooltip text={t('toggleMemoryType.simulated.tooltip')} />
                ),
              },
            ]
          : [
              {
                label: t('toggleMemoryType.agent.label'),
                value: 'templated',
                postIcon: (
                  <InfoTooltip text={t('toggleMemoryType.agent.tooltip')} />
                ),
              },
            ]
      }
    />
  );
}

type VisualMode = 'aside' | 'page';

function MemoryPageRenderer() {
  const { visibleMemoryType } = useVisibleMemoryTypeContext();

  if (visibleMemoryType === 'agent') {
    return <AgentMemory />;
  }

  return <TemplateMemory />;
}

function MemoryAsideRender() {
  return (
    <HStack fullWidth gap={false} fullHeight>
      <VStack paddingRight="xsmall" borderRight fullHeight fullWidth>
        <TemplateMemory />
      </VStack>
      <VStack
        paddingLeft="xsmall"
        fullHeight
        fullWidth
        color="background-grey2"
      >
        <AgentMemory minimal />
      </VStack>
    </HStack>
  );
}

export function EditMemory() {
  const [visualMode, setVisualMode] = useState<VisualMode>('page');
  const { isTemplate } = useCurrentAgentMetaData();

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const { data: isSplitViewEnabled } = useFeatureFlag(
    'SPLIT_VIEW_MEMORY_EDITOR',
  );

  return (
    <PanelMainContent variant="noPadding">
      <QuickMemoryOnboarding>
        <VisibleMemoryTypeProvider
          key={isTemplate ? 'templated' : 'agent'}
          defaultVisibleMemoryType={isTemplate ? 'templated' : 'agent'}
        >
          <MemoryOnboarding>
            <VStack
              className="core-memory-panel"
              overflow="auto"
              fullHeight
              gap={false}
            >
              <HStack align="end" gap={false} fullWidth paddingX="small">
                {isTemplate && isSplitViewEnabled && (
                  <HStack
                    paddingTop="xxsmall"
                    paddingBottom="xxsmall"
                    paddingLeft={false}
                    paddingRight="xsmall"
                    className="h-[28px]"
                  >
                    <Button
                      hideLabel
                      size="3xsmall"
                      onClick={() => {
                        setVisualMode((prev) =>
                          prev === 'page' ? 'aside' : 'page',
                        );
                      }}
                      active={visualMode === 'aside'}
                      color="tertiary"
                      label={
                        visualMode === 'page'
                          ? t('VisualMode.viewAside')
                          : t('VisualMode.viewPage')
                      }
                      preIcon={<SplitscreenRightIcon size="auto" />}
                    />
                  </HStack>
                )}

                {visualMode === 'page' ? (
                  <HStack fullWidth>
                    <MemoryTabs />
                  </HStack>
                ) : (
                  <HStack
                    gap={false}
                    fullWidth
                    className="h-[28px]"
                    align="center"
                  >
                    <HStack fullWidth>
                      <Typography bold variant="body3">
                        {t('toggleMemoryType.templated.label')}
                      </Typography>
                    </HStack>
                    {/* this is a hack to allow the width to be correctly sized since advanced button adds extra space and is a dynamic button */}
                    <div className="opacity-0 pointer-events-none">
                      <AdvancedEditorButton />
                    </div>
                    <HStack fullWidth>
                      <Typography bold variant="body3">
                        {t('toggleMemoryType.simulated.label')}
                      </Typography>
                    </HStack>
                  </HStack>
                )}
                <AdvancedEditorButton />
              </HStack>
              <VStack
                fullWidth
                collapseHeight
                flex
                overflow="auto"
                paddingX="small"
                paddingTop="xxsmall"
                gap={false}
                paddingBottom="small"
              >
                <AdvancedCoreMemoryEditor />

                {visualMode === 'page' ? (
                  <MemoryPageRenderer />
                ) : (
                  <MemoryAsideRender />
                )}
              </VStack>
            </VStack>
          </MemoryOnboarding>
        </VisibleMemoryTypeProvider>
      </QuickMemoryOnboarding>
    </PanelMainContent>
  );
}

export function useEditCoreMemoriesTitle() {
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { memory } = useCurrentAgent();

  const memoryCount = (memory?.blocks || []).length;

  return t('title', { count: memoryCount || '-' });
}
