'use client';
import {
  Button,
  Typography,
  VStack,
  HStack,
  LettaToolIcon,
  SearchIcon,
  TestMemoryIcon,
  AgentValidationIcon,
  CheckReasoningIcon,
} from '@letta-cloud/ui-component-library';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCurrentAgent } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { AgentChatInput } from '../AgentChatInput/AgentChatInput';
import { useSendMessage } from '@letta-cloud/ui-ade-components';
import { QuickAgentSimulatorOnboarding } from '../QuickAgentSimulatorOnboarding';

type PromptKey =
  | 'agentValidation'
  | 'testMemory'
  | 'runTool'
  | 'checkReasoning';

interface ShowPromptsProps {
  promptKey: PromptKey;
}

function ShowPrompts({ promptKey }: ShowPromptsProps) {
  const t = useTranslations('ADE/AgentSimulator');
  const { id: agentId } = useCurrentAgent();
  const { sendMessage } = useSendMessage();

  const handlePromptClick = useCallback(
    (prompt: string) => {
      if (agentId) {
        sendMessage({
          agentId,
          message: {
            type: 'default',
            role: {
              value: 'user',
              label: 'User',
            },
            content: prompt,
          },
        });
      }
    },
    [agentId, sendMessage],
  );

  const promptsMap: Record<PromptKey, string[]> = useMemo(
    () => ({
      agentValidation: [
        t('examples.prompts.agentValidation.prompts.0'),
        t('examples.prompts.agentValidation.prompts.1'),
        t('examples.prompts.agentValidation.prompts.2'),
      ],
      testMemory: [
        t('examples.prompts.testMemory.prompts.0'),
        t('examples.prompts.testMemory.prompts.1'),
        t('examples.prompts.testMemory.prompts.2'),
      ],
      runTool: [
        t('examples.prompts.runTool.prompts.0'),
        t('examples.prompts.runTool.prompts.1'),
        t('examples.prompts.runTool.prompts.2'),
      ],
      checkReasoning: [
        t('examples.prompts.checkReasoning.prompts.0'),
        t('examples.prompts.checkReasoning.prompts.1'),
        t('examples.prompts.checkReasoning.prompts.2'),
      ],
    }),
    [t],
  );

  const prompts = promptsMap[promptKey];

  return (
    <VStack padding="small" gap="small" color="background">
      {prompts.map((prompt: string, index: number) => (
        <Button
          key={index}
          label={prompt}
          color="tertiary"
          size="small"
          bold={false}
          preIcon={<SearchIcon />}
          onClick={() => handlePromptClick(prompt)}
        />
      ))}
    </VStack>
  );
}

export function AgentSimulatorEmptyState() {
  const [selectedPromptCategory, setSelectedPromptCategory] =
    useState<PromptKey | null>(null);
  const promptsContainerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('ADE/AgentSimulator');

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        promptsContainerRef.current &&
        !promptsContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedPromptCategory(null);
      }
    },
    [setSelectedPromptCategory],
  );

  useEffect(() => {
    if (selectedPromptCategory) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedPromptCategory, handleClickOutside]);

  // no-op

  return (
    <HStack fullHeight fullWidth justify="center">
      <VStack
        fullHeight
        fullWidth
        justify="center"
        className="largerThanMobile:px-[10%]"
      >
        <QuickAgentSimulatorOnboarding>
          {/*Prevent layout shift when suggested prompt appears*/}
          <div
            className="w-full"
            style={{
              height: 335,
            }}
          >
            <VStack paddingX="medium" paddingY="xlarge">
              <Typography variant="heading4">
                {t('emptyStateQuestion')}
              </Typography>
            </VStack>
            <AgentChatInput />
            {selectedPromptCategory ? (
              <VStack
                border
                ref={promptsContainerRef}
                className="-mt-6 mx-3 animate-in fade-in-0 zoom-in-95 origin-top transform-gpu duration-200 ease-out"
              >
                <ShowPrompts promptKey={selectedPromptCategory} />
              </VStack>
            ) : (
              <HStack
                paddingX="medium"
                gap="medium"
                fullWidth
                className={`flex-wrap`}
              >
                <Button
                  label={t('examples.prompts.agentValidation.label')}
                  size="small"
                  color="secondary"
                  preIcon={<AgentValidationIcon />}
                  onClick={() => setSelectedPromptCategory('agentValidation')}
                />
                <Button
                  label={t('examples.prompts.testMemory.label')}
                  size="small"
                  color="secondary"
                  preIcon={<TestMemoryIcon />}
                  onClick={() => setSelectedPromptCategory('testMemory')}
                />
                <Button
                  label={t('examples.prompts.runTool.label')}
                  size="small"
                  color="secondary"
                  preIcon={<LettaToolIcon />}
                  onClick={() => setSelectedPromptCategory('runTool')}
                />
                <Button
                  label={t('examples.prompts.checkReasoning.label')}
                  size="small"
                  color="secondary"
                  preIcon={<CheckReasoningIcon />}
                  onClick={() => setSelectedPromptCategory('checkReasoning')}
                />
              </HStack>
            )}
          </div>
        </QuickAgentSimulatorOnboarding>
      </VStack>
    </HStack>
  );
}
