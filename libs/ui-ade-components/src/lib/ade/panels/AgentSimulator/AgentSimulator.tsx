'use client';
import {
  Button,
  Typography,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { OnboardingAsideFocus } from '../../../OnboardingAsideFocus/OnboardingAsideFocus';

import { useCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { Messages } from '../Messages/Messages';
import {
  chatroomRenderModeAtom,
  isSendingMessageAtom,
  showRunDebuggerAtom,
} from './atoms';
import { ErrorBoundary } from 'react-error-boundary';
import { useQuickADETour } from '../../../hooks/useQuickADETour/useQuickADETour';
import { AgentSimulatorHeader } from './AgentSimulatorHeader/AgentSimulatorHeader';
import { useAtom } from 'jotai';
import { AgentChatInput } from './AgentChatInput/AgentChatInput';
import { RunDebugViewer } from './RunDebugViewer/RunDebugViewer';
import { useAgentMessages } from '../../../hooks/useAgentMessages/useAgentMessages';
import { AgentSimulatorEmptyState } from './AgentSimulatorEmptyState';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { AgentMessenger } from './AgentMessenger/AgentMessenger';

interface AgentSimulatorOnboardingProps {
  children: React.ReactNode;
}

function AgentSimulatorOnboarding(props: AgentSimulatorOnboardingProps) {
  const t = useTranslations('ADE/AgentSimulator');
  const { children } = props;

  const { currentStep, setStep } = useQuickADETour();

  if (currentStep !== 'simulator') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('AgentSimulatorOnboarding.title')}
      placement="left-start"
      description={t('AgentSimulatorOnboarding.description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          data-testid="onboarding-next-to-memory"
          fullWidth
          size="large"
          bold
          onClick={() => {
            trackClientSideEvent(
              AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED,
              {
                onboarding_type: 'create:new_agent',
                onboarding_step: 'view_agent_simulator',
              },
            );

            setStep('memory');
          }}
          label={t('AgentSimulatorOnboarding.next')}
        />
      }
      currentStep={2}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function InvalidMessages() {
  const t = useTranslations('ADE/AgentSimulator');

  return (
    <VStack padding fullHeight fullWidth>
      <WarningIcon size="xxlarge" color="destructive" />
      <Typography variant="heading5">{t('InvalidMessages.title')}</Typography>
      <Typography>{t('InvalidMessages.description')}</Typography>
      {/*<Code fullHeight language="javascript" code={JSON.stringify(error, null, 2)} />*/}
    </VStack>
  );
}

export function AgentSimulator() {
  const { id: agentId } = useCurrentAgent();
  const { data } = useAgentMessages({
    agentId,
  });

  const { data: newMessenger } = useFeatureFlag('RUN_MESSAGE_VIEW');

  const [renderMode] = useAtom(chatroomRenderModeAtom);
  const [isPending] = useAtom(isSendingMessageAtom);
  const [showRunDebugger] = useAtom(showRunDebuggerAtom);

  if (newMessenger) {
    return (
      <AgentSimulatorOnboarding>
        <VStack position="relative" gap={false} fullHeight fullWidth>
          <AgentSimulatorHeader />
          <AgentMessenger />
        </VStack>
      </AgentSimulatorOnboarding>
    )
  }

  return (
    <AgentSimulatorOnboarding>
      <VStack position="relative" gap={false} fullHeight fullWidth>
        <AgentSimulatorHeader />

        {data && data?.pages[0].length === 1 ? (
          <AgentSimulatorEmptyState />
        ) : (
          <VStack collapseHeight gap={false} fullWidth>
            <VStack gap={false} collapseHeight>
              <VStack collapseHeight position="relative">
                <ErrorBoundary fallback={<InvalidMessages />}>
                  <Messages
                    isSendingMessage={isPending}
                    renderAgentsLink
                    injectSpaceForHeader
                    mode={renderMode}
                    isPanelActive
                    agentId={agentId || ''}
                  />
                </ErrorBoundary>
              </VStack>
              {showRunDebugger && <RunDebugViewer />}
              {data && <AgentChatInput />}
            </VStack>
          </VStack>
        )}
      </VStack>
    </AgentSimulatorOnboarding>
  );
}
