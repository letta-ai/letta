import {
  Button,
  CoreMemoryEditor,
  EmptyBlockIcon,
  MemoryBlocksIcon,
  OnboardingAsideFocus,
  PlusIcon,
  TabGroup,
  Typography,
} from '@letta-cloud/ui-component-library';
import { InfoTooltip } from '@letta-cloud/ui-component-library';
import { LettaLoaderPanel } from '@letta-cloud/ui-component-library';
import { HStack } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { PanelMainContent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../hooks';
import { useCallback, useState } from 'react';
import React, { useMemo } from 'react';
import { useSortedMemories } from '@letta-cloud/utils-client';
import { useUpdateMemory } from '../../hooks';
import { useCurrentAgentMetaData } from '../../hooks';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  AdvancedCoreMemoryEditor,
  CreateNewMemoryBlockForm,
  useAdvancedCoreMemoryEditor,
} from './AdvancedCoreMemoryEditor';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADETour } from '../../hooks/useADETour/useADETour';
import './EditCoreMemoriesPanel.css';
import type { Block } from '@letta-cloud/sdk-core';
import { useBlocksServiceListAgentsForBlock } from '@letta-cloud/sdk-core';
import { useRouter } from 'next/navigation';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useADEAppContext } from '../../AppContext/AppContext';

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  memoryType: 'simulated' | 'templated';
  disabled?: boolean;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, memory, memoryType, disabled } = props;
  const { id } = useCurrentAgent();
  const { isLocal } = useCurrentAgentMetaData();
  const { projectSlug } = useADEAppContext();

  const { data: agents } = useBlocksServiceListAgentsForBlock(
    {
      blockId: memory.id || '',
    },
    undefined,
    {
      enabled: !!memory.id,
    },
  );

  const { push } = useRouter();

  const handleMoveToAgent = useCallback(
    (agentId: string) => {
      if (CURRENT_RUNTIME === 'letta-desktop') {
        push(`/dashboard/agents/${agentId}`);

        return;
      }

      if (projectSlug) {
        if (!isLocal) {
          push(`/projects/${projectSlug}/agents/${agentId}`);
          return;
        }

        push(`${projectSlug}/agents/${agentId}`);
        return;
      }

      push('/agents');
    },
    [isLocal, projectSlug, push],
  );

  const sharedAgents = useMemo(() => {
    if (!agents) {
      return [];
    }

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      agentType: agent.agent_type,
      onClick: () => {
        handleMoveToAgent(agent.id);
      },
      isCurrentAgent: agent.id === id,
    }));
  }, [agents, handleMoveToAgent, id]);

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

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <CoreMemoryEditor
      memoryBlock={{
        ...memory,
        value,
      }}
      showDiff
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
        fullHeight
        border="dashed"
      >
        <VStack paddingY="small">
          <EmptyBlockIcon size="xlarge" />
        </VStack>
        <Typography color="lighter" variant="body2">
          {t('MemoryWrapper.emptyMemoryBlock')}
        </Typography>
        <CreateNewMemoryBlockForm
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
      </VStack>
    );
  }

  return (
    <VStack fullHeight gap="large">
      {children}
    </VStack>
  );
}

function DefaultMemory() {
  const agent = useCurrentAgent();

  const memories = useSortedMemories(agent);
  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block) => (
        <EditMemoryForm
          key={block.label}
          memory={block}
          memoryType="templated"
          label={block.label || ''}
        />
      ))}
    </MemoryWrapper>
  );
}

function SimulatedMemory() {
  const { agentSession } = useCurrentSimulatedAgent();
  const agent = useMemo(() => {
    return agentSession?.body.agent;
  }, [agentSession]);

  const memories = useSortedMemories(agent);

  if (!agent) {
    return <LettaLoaderPanel />;
  }

  return (
    <MemoryWrapper memoryCount={memories.length}>
      {memories.map((block) => (
        <EditMemoryForm
          key={block.label}
          disabled
          memory={block}
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

type MemoryType = 'simulated' | 'templated';

function AdvancedEditorButton() {
  const { open } = useAdvancedCoreMemoryEditor();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { memory } = useCurrentAgent();

  const firstLabel = useMemo(() => {
    return memory?.blocks?.[0]?.label;
  }, [memory]);

  return (
    <HStack
      fullWidth
      fullHeight
      paddingTop="xxsmall"
      paddingBottom="xxsmall"
      align="center"
      position="relative"
      justify="end"
    >
      <Button
        color="secondary"
        size="xsmall"
        bold
        _use_rarely_className="hide-label-on-core-memory-size"
        preIcon={<MemoryBlocksIcon />}
        label={t('advancedEditor')}
        onClick={() => {
          open(firstLabel || undefined);
        }}
      />
      <Button
        color="secondary"
        size="xsmall"
        bold
        hideLabel
        _use_rarely_className="show-label-on-core-memory-size"
        preIcon={<MemoryBlocksIcon />}
        label={t('advancedEditor')}
        onClick={() => {
          open(firstLabel || undefined);
        }}
      />
    </HStack>
  );
}

export function EditMemory() {
  const { isTemplate } = useCurrentAgentMetaData();

  const [memoryType, setMemoryType] = useState<MemoryType>('templated');

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  return (
    <PanelMainContent variant="noPadding">
      <MemoryOnboarding>
        <VStack
          className="core-memory-panel"
          overflow="auto"
          fullHeight
          gap={false}
        >
          <VStack paddingX="small">
            <TabGroup
              color="transparent"
              bold
              extendBorder
              rightContent={<AdvancedEditorButton />}
              size="xsmall"
              value={memoryType}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                setMemoryType(value as MemoryType);
              }}
              items={
                isTemplate
                  ? [
                      {
                        label: t('toggleMemoryType.templated.label'),
                        value: 'templated',
                        postIcon: (
                          <InfoTooltip
                            text={t('toggleMemoryType.templated.tooltip')}
                          />
                        ),
                      },
                      {
                        label: t('toggleMemoryType.simulated.label'),
                        value: 'simulated',
                        postIcon: (
                          <InfoTooltip
                            text={t('toggleMemoryType.simulated.tooltip')}
                          />
                        ),
                      },
                    ]
                  : [
                      {
                        label: t('toggleMemoryType.agent.label'),
                        value: 'templated',
                        postIcon: (
                          <InfoTooltip
                            text={t('toggleMemoryType.agent.tooltip')}
                          />
                        ),
                      },
                    ]
              }
            />
          </VStack>
          <VStack
            paddingTop="xsmall"
            fullWidth
            collapseHeight
            flex
            overflow="auto"
            gap="small"
            paddingX="small"
            paddingBottom="small"
          >
            <AdvancedCoreMemoryEditor />

            {memoryType === 'templated' ? (
              <DefaultMemory />
            ) : (
              <SimulatedMemory />
            )}
          </VStack>
        </VStack>
      </MemoryOnboarding>
    </PanelMainContent>
  );
}

export function useEditCoreMemoriesTitle() {
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { memory } = useCurrentAgent();

  const memoryCount = (memory?.blocks || []).length;

  return t('title', { count: memoryCount || '-' });
}
