import {
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  InlineTextDiff,
  LockClosedIcon,
  LockOpenRightIcon,
  MemoryBlocksIcon,
  OnboardingAsideFocus,
  RawInputContainer,
  Spinner,
  StatusIndicator,
  TabGroup,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import { InfoTooltip } from '@letta-cloud/ui-component-library';
import { LettaLoaderPanel } from '@letta-cloud/ui-component-library';
import {
  HStack,
  RawTextArea,
  Typography,
} from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { PanelMainContent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../hooks';
import { useEffect, useRef, useState } from 'react';
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
import { SharedMemoryIndicator } from './SharedMemoryIndicator/SharedMemoryIndicator';
import { useLocalStorage } from '@mantine/hooks';
import './EditCoreMemoriesPanel.css';
import type { Block } from '@letta-cloud/sdk-core';

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
  disabled?: boolean;
}

interface CollapseComponentProps {
  collapsed?: boolean;
  onToggle: VoidFunction;
}

function CollapseComponent(props: CollapseComponentProps) {
  const { collapsed, onToggle } = props;
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  return (
    <Button
      size="xsmall"
      color="tertiary"
      label={
        collapsed
          ? t('CollapseComponent.expand')
          : t('CollapseComponent.collapse')
      }
      onClick={onToggle}
      hideLabel
      preIcon={collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
    />
  );
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  memoryType: 'simulated' | 'templated';
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, disabled, memory, memoryType } = props;
  const { id } = useCurrentAgent();

  const [collapsed, setCollapsed] = useLocalStorage<boolean>({
    key: `collapse-memory-${label}-${id}`,
  });

  const { isTemplate } = useCurrentAgentMetaData();

  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { open } = useAdvancedCoreMemoryEditor();

  const {
    value: templateValue,
    onChange,
    hasChangedRemotely,
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

  const isLocked = useMemo(() => {
    return !!disabled || !canUpdateAgent;
  }, [disabled, canUpdateAgent]);

  return (
    <VStack
      flex={!collapsed}
      collapseHeight={!collapsed}
      fullHeight={!collapsed}
    >
      <VStack fullWidth fullHeight>
        {isLocked ? (
          <VStack fullHeight fullWidth>
            <ReadonlyTextArea
              showDiff
              hideInput={collapsed}
              labelBadge={<SharedMemoryIndicator memory={memory} />}
              label={label}
              value={value}
              testId={`edit-memory-block-${label}-content`}
              rightOfLabelContent={
                <HStack align="center" gap="small">
                  <Typography variant="body3" color="muted">
                    {t('EditMemoryForm.characterLimit', {
                      count: value.length,
                      limit: memory.limit,
                    })}
                  </Typography>
                  <CollapseComponent
                    collapsed={collapsed}
                    onToggle={() => {
                      setCollapsed(!collapsed);
                    }}
                  />
                </HStack>
              }
            />
          </VStack>
        ) : (
          <RawTextArea
            hideInput={collapsed}
            variant="secondary"
            labelBadge={<SharedMemoryIndicator memory={memory} />}
            rightOfLabelContent={
              <HStack align="center" gap="small">
                {!isTemplate && hasChangedRemotely && (
                  <Tooltip content={t('EditMemoryForm.hasChangedRemotely')}>
                    <StatusIndicator status="brand" animate />
                  </Tooltip>
                )}
                {isUpdating && <Spinner size="xsmall" />}
                <Typography variant="body3" color="muted">
                  {t('EditMemoryForm.characterLimit', {
                    count: value.length,
                    limit: memory.limit,
                  })}
                </Typography>
                <CollapseComponent
                  collapsed={collapsed}
                  onToggle={() => {
                    setCollapsed(!collapsed);
                  }}
                />
              </HStack>
            }
            autosize={false}
            flex
            fullHeight
            data-testid={`edit-memory-block-${label}-content`}
            fullWidth
            label={label}
            onChange={(e) => {
              // originalMemory.current.value = e.target.value;
              onChange(e.target.value);
            }}
            expandable={{
              expandText: t('expandContent'),
              onExpand: () => {
                open(label);
              },
            }}
            value={value}
          />
        )}
      </VStack>
      {!!error && (
        <HStack align="center" justify="spaceBetween">
          <HStack paddingBottom="small" justify="start">
            <Typography variant="body2" color="destructive">
              {t('error')}
            </Typography>
          </HStack>
        </HStack>
      )}
    </VStack>
  );
}

interface DefaultMemoryProps {
  isLocked?: boolean;
}

function DefaultMemory(props: DefaultMemoryProps) {
  const agent = useCurrentAgent();
  const { isLocked } = props;

  const memories = useSortedMemories(agent);

  return (
    <>
      <VStack collapseHeight flex gap="large">
        {memories.map((block) => (
          <EditMemoryForm
            disabled={isLocked}
            key={block.label}
            memory={block}
            memoryType="templated"
            label={block.label || ''}
          />
        ))}
      </VStack>
    </>
  );
}

interface ReadonlyTextAreaProps {
  value: string;
  label: string;
  testId?: string;
  labelBadge?: React.ReactNode;
  rightOfLabelContent?: React.ReactNode;
  hideInput?: boolean;
  showDiff?: boolean;
}

function ReadonlyTextArea(props: ReadonlyTextAreaProps) {
  const {
    value,
    label,
    hideInput,
    testId,
    showDiff,
    labelBadge,
    rightOfLabelContent,
  } = props;

  const initialState = useRef<string>(value);

  useEffect(() => {
    const state = setTimeout(() => {
      initialState.current = value;
    }, 5000);

    return () => {
      clearTimeout(state);
    };
  }, [value]);

  return (
    <RawInputContainer
      fullWidth
      fullHeight
      labelBadge={labelBadge}
      flex
      hideInput={hideInput}
      label={label}
      rightOfLabelContent={rightOfLabelContent}
    >
      <VStack
        fullWidth
        fullHeight
        overflow="auto"
        color="background"
        className="px-3 py-2"
        border
        flex
      >
        <Typography
          className="whitespace-pre-wrap"
          data-testid={testId}
          variant="body"
          color="lighter"
        >
          {showDiff ? (
            <InlineTextDiff text={initialState.current} comparedText={value} />
          ) : (
            value
          )}
        </Typography>
      </VStack>
    </RawInputContainer>
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
    <VStack collapseHeight flex gap="large">
      {memories.map((block) => (
        <EditMemoryForm
          key={block.label}
          disabled
          memory={block}
          memoryType="simulated"
          label={block.label || ''}
        />
      ))}
    </VStack>
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

interface ManageMemoryLockProps {
  isLocked: boolean;
  memoryType: MemoryType;
  onLockChange: (value: boolean) => void;
}

function ManageMemoryLock(props: ManageMemoryLockProps) {
  const { isLocked, memoryType, onLockChange } = props;

  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const lockOverride = useMemo(() => {
    if (memoryType === 'simulated') {
      return true;
    }

    return isLocked;
  }, [isLocked, memoryType]);

  const label = useMemo(() => {
    if (memoryType === 'simulated') {
      return t('ManageMemoryLock.simulated');
    }

    return isLocked
      ? t('ManageMemoryLock.locked')
      : t('ManageMemoryLock.unlocked');
  }, [memoryType, isLocked, t]);

  return (
    <Button
      size="small"
      square
      color="tertiary"
      active={lockOverride}
      hideLabel
      data-testid={'lock-memory'}
      onClick={() => {
        onLockChange(!isLocked);
      }}
      preIcon={lockOverride ? <LockClosedIcon /> : <LockOpenRightIcon />}
      label={label}
    />
  );
}

export function EditMemory() {
  const { isTemplate, agentId } = useCurrentAgentMetaData();

  const [memoryType, setMemoryType] = useState<MemoryType>('templated');
  const [isLocked, setIsLocked] = useLocalStorage<boolean>({
    defaultValue: true,
    key: `lock-editing-memory-${agentId}`,
  });

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
            <HStack
              fullWidth
              borderBottom
              paddingTop="xxsmall"
              paddingBottom="xxsmall"
              align="center"
              justify="spaceBetween"
            >
              <HStack gap="small">
                <ManageMemoryLock
                  isLocked={isLocked}
                  memoryType={memoryType}
                  onLockChange={setIsLocked}
                />
                <TabGroup
                  variant="chips"
                  bold
                  color="dark"
                  size="xsmall"
                  value={memoryType}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }

                    setMemoryType(value as MemoryType);
                  }}
                  fullWidth
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
              </HStack>
              <AdvancedEditorButton />
            </HStack>
          </VStack>
          <VStack
            paddingTop="small"
            fullWidth
            collapseHeight
            flex
            overflow="auto"
            gap="small"
            paddingX="large"
            paddingBottom="small"
          >
            <AdvancedCoreMemoryEditor />

            {memoryType === 'templated' ? (
              <DefaultMemory isLocked={isLocked} />
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
