import {
  Button,
  OnboardingAsideFocus,
  Spinner,
  TabGroup,
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
import { useState } from 'react';
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

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
}

type EditMemoryFormProps = AdvancedEditorPayload;

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, memory } = props;

  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { open } = useAdvancedCoreMemoryEditor();

  const { value, onChange, error, isUpdating } = useUpdateMemory({
    label,
  });

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <>
      <VStack flex fullHeight>
        <VStack fullWidth fullHeight>
          <RawTextArea
            disabled={!canUpdateAgent}
            variant="secondary"
            rightOfLabelContent={
              <HStack align="center">
                {isUpdating && <Spinner size="xsmall" />}
                <Typography variant="body2" color="muted">
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

function DefaultMemory() {
  const agent = useCurrentAgent();

  const memories = useSortedMemories(agent);

  return (
    <>
      <AdvancedCoreMemoryEditor />
      <VStack fullHeight gap="large">
        {memories.map((block) => (
          <VStack fullHeight key={block.label || ''}>
            <EditMemoryForm memory={block} label={block.label || ''} />
          </VStack>
        ))}
      </VStack>
    </>
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
            <RawTextArea
              autosize={false}
              flex
              fullHeight
              resize="none"
              fullWidth
              data-testid={`simulated-memory:${block.label}`}
              disabled
              rightOfLabelContent={
                <Typography variant="body2" color="muted">
                  {t('SimulatedMemory.characterCount', {
                    count: block.value.length,
                  })}
                </Typography>
              }
              label={block.label || ''}
              value={block.value}
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
      difficulty="medium"
      totalSteps={3}
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
      currentStep={1}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

type MemoryType = 'simulated' | 'templated';

export function EditMemory() {
  const { isTemplate } = useCurrentAgentMetaData();
  const [memoryType, setMemoryType] = useState<MemoryType>('templated');
  const { open } = useAdvancedCoreMemoryEditor();
  const { memory } = useCurrentAgent();

  const firstLabel = useMemo(() => {
    return memory?.blocks?.[0]?.label;
  }, [memory]);

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  return (
    <PanelMainContent variant="noPadding">
      <MemoryOnboarding>
        <VStack fullHeight gap={false}>
          <VStack paddingX="small">
            <HStack align="end">
              <TabGroup
                extendBorder
                rightContent={
                  firstLabel && (
                    <HStack
                      fullWidth
                      fullHeight
                      paddingTop="xxsmall"
                      paddingBottom="xxsmall"
                      align="center"
                      justify="end"
                    >
                      <Button
                        color="tertiary"
                        size="small"
                        label={t('advancedEditor')}
                        onClick={() => {
                          open(firstLabel);
                        }}
                      />
                    </HStack>
                  )
                }
                size="small"
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
          </VStack>
          <VStack
            paddingTop="small"
            fullHeight
            gap="small"
            paddingX="large"
            paddingBottom="small"
          >
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
