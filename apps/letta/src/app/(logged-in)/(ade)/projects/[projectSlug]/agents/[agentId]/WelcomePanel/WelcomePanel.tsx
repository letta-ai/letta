import type { PanelTemplate } from '@letta-web/component-library';
import {
  ADESidebarButton,
  ChatBubbleIcon,
  InlineCode,
} from '@letta-web/component-library';
import { Logo, VStack } from '@letta-web/component-library';
import { PanelMainContent, Typography } from '@letta-web/component-library';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { BoxesIcon, BrainIcon } from 'lucide-react';
import { PanelOpener } from '../panelRegistry';
import { useCurrentAgent } from '../hooks';

const WelcomePanelDataSchema = z.object({
  firstTime: z.boolean(),
});

function TemplateVersionManagerButton() {
  const t = useTranslations('ADE/Welcome');

  return (
    <PanelOpener templateId="deployment" data={undefined} id="deployment">
      <ADESidebarButton
        inline
        label={t('templateVersionButton')}
        icon={<BoxesIcon />}
      />
    </PanelOpener>
  );
}

function ArchiveMemoriesButton() {
  const t = useTranslations('ADE/Welcome');

  return (
    <PanelOpener
      templateId="archival-memories"
      data={{}}
      id="archival-memories"
    >
      <ADESidebarButton
        inline
        label={t('archivalMemoriesButton')}
        icon={<BrainIcon />}
      />
    </PanelOpener>
  );
}

function AgentSimulatorButton() {
  const t = useTranslations('ADE/Welcome');

  return (
    <PanelOpener
      templateId="agent-simulator"
      data={undefined}
      id="agent-simulator"
    >
      <ADESidebarButton
        inline
        label={t('simulateButton')}
        icon={<ChatBubbleIcon />}
      />
    </PanelOpener>
  );
}

function WelcomePanel() {
  const { name } = useCurrentAgent();
  const t = useTranslations('ADE/Welcome');

  return (
    <PanelMainContent>
      <VStack paddingX="large" paddingY="large" width="centered">
        <VStack paddingY>
          <Logo size="large" />
        </VStack>
        <Typography variant="heading2">{t('title')}</Typography>
        <Typography variant="panelInfo">{t('message')}</Typography>

        <Typography variant="panelInfo">
          {t.rich('more', {
            templateName: () => <InlineCode code={name} />,
          })}
        </Typography>
        <VStack paddingY paddingLeft as="ul">
          <li className="list-disc">
            {t.rich('exploreArchivalMemories', {
              archivalMemoriesButton: () => <ArchiveMemoriesButton />,
            })}
          </li>
          <li className="list-disc">
            {t.rich('simulate', {
              agentSimulatorButton: () => <AgentSimulatorButton />,
            })}
          </li>
        </VStack>
        <Typography variant="panelInfo">
          {t.rich('evenMore', {
            templateVersionButton: () => <TemplateVersionManagerButton />,
          })}
        </Typography>
      </VStack>
    </PanelMainContent>
  );
}

export const welcomePanelTemplate = {
  templateId: 'welcome-panel',
  content: WelcomePanel,
  useGetTitle: () => 'Welcome',
  data: WelcomePanelDataSchema,
} satisfies PanelTemplate<'welcome-panel'>;
