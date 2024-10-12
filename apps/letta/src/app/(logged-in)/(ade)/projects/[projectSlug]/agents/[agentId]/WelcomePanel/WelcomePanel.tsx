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
import { BoxesIcon, BrainIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { PanelOpener } from '../panelRegistry';
import { useAtom } from 'jotai';
import { folderStatesAtom } from '../ADESidebar/ADESidebar';
import React, { useCallback, useMemo } from 'react';
import { useCurrentAgent } from '../hooks';

const WelcomePanelDataSchema = z.object({
  firstTime: z.boolean(),
});

type WelcomePanelProps = z.infer<typeof WelcomePanelDataSchema>;

function TemplateVersionManagerButton() {
  const t = useTranslations('ADE/Welcome');

  return (
    <PanelOpener templateId="deployment" data={undefined} id="deployment">
      <ADESidebarButton
        inline
        label={t('firstTime.templateVersionButton')}
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
        label={t('firstTime.archivalMemoriesButton')}
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
        label={t('firstTime.simulateButton')}
        icon={<ChatBubbleIcon />}
      />
    </PanelOpener>
  );
}

function OpenEditMemoryBlocksButton() {
  const t = useTranslations('ADE/Welcome');
  const [folderStates, setFolderStates] = useAtom(folderStatesAtom);
  const isOpen = useMemo(
    () => folderStates['edit-memory-block'],
    [folderStates]
  );

  const handleOpen = useCallback(() => {
    setFolderStates((prev) => ({
      ...prev,
      'edit-memory-block': !isOpen,
    }));
  }, [isOpen, setFolderStates]);

  return (
    <ADESidebarButton
      inline
      label={t('firstTime.editMemoryBlocksButton')}
      icon={isOpen ? <ChevronDown /> : <ChevronRight />}
      onClick={handleOpen}
    />
  );
}

function OpenDataSourcesButton() {
  const t = useTranslations('ADE/Welcome');
  const [folderStates, setFolderStates] = useAtom(folderStatesAtom);
  const isOpen = useMemo(
    () => folderStates['edit-data-source'],
    [folderStates]
  );

  const handleOpen = useCallback(() => {
    setFolderStates((prev) => ({
      ...prev,
      'edit-data-sources': !isOpen,
    }));
  }, [isOpen, setFolderStates]);

  return (
    <ADESidebarButton
      inline
      label={t('firstTime.editDataSourcesButton')}
      icon={isOpen ? <ChevronDown /> : <ChevronRight />}
      onClick={handleOpen}
    />
  );
}

function WelcomePanel(props: WelcomePanelProps) {
  const { firstTime } = props;
  const { name } = useCurrentAgent();
  const t = useTranslations('ADE/Welcome');

  if (!firstTime) {
    return (
      <PanelMainContent>
        <VStack padding="small">
          <Typography variant="heading2">{t('notFirstTime.title')}</Typography>
          <Typography variant="panelInfo">
            {t('notFirstTime.message')}
          </Typography>
        </VStack>
      </PanelMainContent>
    );
  }

  return (
    <PanelMainContent>
      <VStack paddingX="large" paddingY="large" width="centered">
        <VStack paddingY>
          <Logo size="large" />
        </VStack>
        <Typography variant="heading2">{t('firstTime.title')}</Typography>
        <Typography variant="panelInfo">{t('firstTime.message')}</Typography>

        <Typography variant="panelInfo">
          {t.rich('firstTime.more', {
            templateName: () => <InlineCode code={name} />,
          })}
        </Typography>
        <VStack paddingY paddingLeft as="ul">
          <li className="list-disc">
            {t.rich('firstTime.editMemoryBlocks', {
              memoryBlocksButton: () => <OpenEditMemoryBlocksButton />,
            })}
          </li>
          <li className="list-disc">
            {t.rich('firstTime.editDataSources', {
              dataSourcesButton: () => <OpenDataSourcesButton />,
            })}
          </li>
          <li className="list-disc">
            {t.rich('firstTime.exploreArchivalMemories', {
              archivalMemoriesButton: () => <ArchiveMemoriesButton />,
            })}
          </li>
          <li className="list-disc">
            {t.rich('firstTime.simulate', {
              agentSimulatorButton: () => <AgentSimulatorButton />,
            })}
          </li>
        </VStack>
        <Typography variant="panelInfo">
          {t.rich('firstTime.evenMore', {
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
