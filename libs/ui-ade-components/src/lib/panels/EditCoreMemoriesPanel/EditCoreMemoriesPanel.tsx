import {
  Button,
  CoreMemoryEditor,
  EmptyBlockIcon,
  LinkIcon,
  MemoryBlocksIcon,
  type MemoryType,
  PlusIcon,
  SplitscreenRightIcon,
  TabGroup,
  Typography,
  useVisibleMemoryTypeContext,
  VisibleMemoryTypeProvider,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '../../OnboardingAsideFocus/OnboardingAsideFocus';

import { InfoTooltip } from '@letta-cloud/ui-component-library';
import { LettaLoaderPanel } from '@letta-cloud/ui-component-library';
import { HStack } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { PanelMainContent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../hooks';
import { useState } from 'react';
import React, { useMemo } from 'react';
import { useSortedMemories } from '@letta-cloud/utils-client';
import { useUpdateMemory } from '../../hooks';
import { useCurrentAgentMetaData } from '../../hooks';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  AdvancedCoreMemoryEditor,
  useAdvancedCoreMemoryEditor,
} from './AdvancedCoreMemoryEditor';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADETour } from '../../hooks/useADETour/useADETour';
import './EditCoreMemoriesPanel.css';
import type { Block } from '@letta-cloud/sdk-core';
import { CreateNewMemoryBlockDialog } from './CreateNewMemoryBlockDialog/CreateNewMemoryBlockDialog';
import { useQuickADETour } from '../../hooks/useQuickADETour/useQuickADETour';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { AttachMemoryBlockDialog } from './AttachMemoryBlockDialog/AttachMemoryBlockDialog';
import { useSharedAgents } from '../../hooks/useSharedAgents/useSharedAgents';

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  memoryType: 'simulated' | 'templated';
  disabled?: boolean;
  hasSimulatedDiff?: boolean;
  minimal?: boolean;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, memory, memoryType, minimal, hasSimulatedDiff, disabled } =
    props;

  const sharedAgents = useSharedAgents(memory.id || '');

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const {
    value: templateValue,
    onChange,
    error,
    isUpdating,
  } = useUpdateMemory({
    label,
  });

  const value = useMemo(() => {
    if (memoryType !== 'simulated') {
      return templateValue;
    }

    return memory.value;
  }, [templateValue, memoryType, memory.value]);

  const { open } = useAdvancedCoreMemoryEditor();

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <CoreMemoryEditor
      memoryBlock={{
        ...memory,
        value,
      }}
      openInAdvanced={
        memoryType === 'simulated'
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
      isSaving={isUpdating}
      testId={`edit-memory-block-${label}-content`}
      errorMessage={error ? t('error') : ''}
      disabled={!canUpdateAgent || disabled}
      onSave={(value) => {
        onChange(value, true);
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

function DefaultMemory() {
  const agent = useCurrentAgent();
  const { simulatedAgent } = useCurrentSimulatedAgent();

  const simulatedMemoriesLabelMap = useMemo(() => {
    const map = new Map<string, Block>();

    simulatedAgent?.memory?.blocks.forEach((block) => {
      if (block.label) {
        map.set(block.label, block);
      }
    });

    return map;
  }, [simulatedAgent]);

  const memories = useSortedMemories(agent);
  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block) => {
        const simulatedBlock = simulatedMemoriesLabelMap.get(block.label || '');
        const hasSimulatedDiff =
          simulatedBlock && simulatedBlock.value !== block.value;

        return (
          <EditMemoryForm
            key={block.label}
            memory={block}
            memoryType="templated"
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

function SimulatedMemory(props: SimulatedMemoryProps) {
  const { minimal } = props;
  const { simulatedAgent } = useCurrentSimulatedAgent();

  const memories = useSortedMemories(simulatedAgent);

  if (!simulatedAgent) {
    return (
      <VStack paddingTop="xxsmall" fullHeight gap="medium">
        <LettaLoaderPanel />
      </VStack>
    );
  }

  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block) => (
        <EditMemoryForm
          key={block.label}
          disabled
          memory={block}
          minimal={minimal}
          memoryType="simulated"
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
          fullWidth
          size="large"
          bold
          onClick={() => {
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
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { memory } = useCurrentAgent();

  const firstLabel = useMemo(() => {
    return memory?.blocks?.[0]?.label;
  }, [memory]);

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
                value: 'simulated',
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

  if (visibleMemoryType === 'simulated') {
    return <SimulatedMemory />;
  }

  return <DefaultMemory />;
}

function MemoryAsideRender() {
  return (
    <HStack fullWidth gap={false} fullHeight>
      <VStack paddingRight="xsmall" borderRight fullHeight fullWidth>
        <DefaultMemory />
      </VStack>
      <VStack
        paddingLeft="xsmall"
        fullHeight
        fullWidth
        color="background-grey2"
      >
        <SimulatedMemory minimal />
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
        <VisibleMemoryTypeProvider>
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
