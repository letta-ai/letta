import {
  Button,
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
import type { Block } from '@letta-cloud/sdk-core';
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
import './EditCoreMemoriesPanel.scss';

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
  disabled?: boolean;
}

type EditMemoryFormProps = AdvancedEditorPayload;

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, disabled, memory } = props;

  const { isTemplate } = useCurrentAgentMetaData();

  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { open } = useAdvancedCoreMemoryEditor();

  const { value, onChange, hasChangedRemotely, error, isUpdating } =
    useUpdateMemory({
      label,
    });

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const isLocked = useMemo(() => {
    return !!disabled || !canUpdateAgent;
  }, [disabled, canUpdateAgent]);

  return (
    <>
      <VStack flex fullHeight>
        <VStack fullWidth fullHeight>
          {isLocked ? (
            <VStack fullHeight fullWidth>
              <ReadonlyTextArea
                showDiff
                labelBadge={<SharedMemoryIndicator memory={memory} />}
                label={label}
                value={value}
                testId={`edit-memory-block-${label}-content`}
                rightOfLabelContent={
                  <Typography variant="body3" color="muted">
                    {t('EditMemoryForm.characterLimit', {
                      count: value.length,
                      limit: memory.limit,
                    })}
                  </Typography>
                }
              />
            </VStack>
          ) : (
            <RawTextArea
              variant="secondary"
              labelBadge={<SharedMemoryIndicator memory={memory} />}
              rightOfLabelContent={
                <HStack align="center">
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
    </>
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
      <AdvancedCoreMemoryEditor />
      <VStack fullHeight gap="large">
        {memories.map((block) => (
          <VStack fullHeight key={block.label || ''}>
            <EditMemoryForm
              disabled={isLocked}
              memory={block}
              label={block.label || ''}
            />
          </VStack>
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
  showDiff?: boolean;
}

function ReadonlyTextArea(props: ReadonlyTextAreaProps) {
  const { value, label, testId, showDiff, labelBadge, rightOfLabelContent } =
    props;

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
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const agent = useMemo(() => {
    return agentSession?.body.agent;
  }, [agentSession]);

  const memories = useSortedMemories(agent);

  if (!agent) {
    return <LettaLoaderPanel />;
  }

  return (
    <VStack fullHeight gap="large">
      {memories.map((block) => (
        <VStack fullHeight key={block.label || ''}>
          <VStack fullHeight flex>
            <ReadonlyTextArea
              showDiff
              labelBadge={<SharedMemoryIndicator memory={block} />}
              testId={`simulated-memory:${block.label}`}
              label={block.label || ''}
              value={block.value}
              rightOfLabelContent={
                <Typography variant="body3" color="muted">
                  {t('SimulatedMemory.characterCount', {
                    count: block.value.length,
                  })}
                </Typography>
              }
            />
          </VStack>
        </VStack>
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

interface AdvancedEditorButtonProps {
  memoryType: MemoryType;
}

function AdvancedEditorButton(props: AdvancedEditorButtonProps) {
  const { memoryType } = props;
  const { open } = useAdvancedCoreMemoryEditor();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { memory } = useCurrentAgent();

  const firstLabel = useMemo(() => {
    return memory?.blocks?.[0]?.label;
  }, [memory]);

  if (memoryType === 'simulated') {
    return (
      <HStack
        fullWidth
        fullHeight
        paddingTop="xxsmall"
        paddingBottom="xxsmall"
        align="center"
        justify="end"
      >
        <Tooltip asChild content={t('advancedEditorDisabledDueToSimulated')}>
          <Button
            preIcon={<MemoryBlocksIcon />}
            color="secondary"
            size="xsmall"
            bold
            label={t('advancedEditor')}
            disabled
          />
        </Tooltip>
      </HStack>
    );
  }

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
              paddingBottom="xsmall"
              align="center"
              justify="spaceBetween"
            >
              <HStack gap="small" fullWidth>
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
              <AdvancedEditorButton memoryType={memoryType} />
            </HStack>
          </VStack>
          <VStack
            paddingTop="small"
            fullHeight
            fullWidth
            gap="small"
            paddingX="large"
            paddingBottom="small"
          >
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
