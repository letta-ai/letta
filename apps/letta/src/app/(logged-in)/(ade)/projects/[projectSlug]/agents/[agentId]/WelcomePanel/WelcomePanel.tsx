import type { PanelTemplate } from '@letta-web/component-library';
import { Button } from '@letta-web/component-library';
import { InlineCode } from '@letta-web/component-library';
import { Logo, VStack } from '@letta-web/component-library';
import { PanelMainContent, Typography } from '@letta-web/component-library';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import type { panelRegistry } from '../panelRegistry';
import { usePanelManager } from '../panelRegistry';
import { useCurrentAgent } from '../hooks';
import { useCallback } from 'react';

const WelcomePanelDataSchema = z.object({
  firstTime: z.boolean(),
});

interface GenericPanelOpenerProps {
  panelId: keyof typeof panelRegistry;
  title: string;
}

function GenericPanelOpener(props: GenericPanelOpenerProps) {
  const { panelId, title } = props;

  const { openPanel } = usePanelManager();

  const handleClick = useCallback(() => {
    openPanel({
      templateId: panelId,
      id: panelId,
      data: undefined,
    });
  }, [openPanel, panelId]);

  return (
    <Button size="small" color="tertiary" label={title} onClick={handleClick} />
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
            {t.rich('editMemoryBlocks', {
              editCoreMemoriesButton: () => (
                <GenericPanelOpener
                  panelId="edit-core-memories"
                  title={t('editCoreMemoriesButton')}
                />
              ),
            })}
          </li>
          <li className="list-disc">
            {t.rich('editDataSources', {
              editDataSourcesButton: () => (
                <GenericPanelOpener
                  panelId="edit-data-sources"
                  title={t('editDataSourcesButton')}
                />
              ),
            })}
          </li>
          <li className="list-disc">
            {t.rich('exploreArchivalMemories', {
              archivalMemoriesButton: () => (
                <GenericPanelOpener
                  panelId="archival-memories"
                  title={t('archivalMemoriesButton')}
                />
              ),
            })}
          </li>
          <li className="list-disc">
            {t.rich('simulate', {
              agentSimulatorButton: () => (
                <GenericPanelOpener
                  panelId="agent-simulator"
                  title={t('agentSimulatorButton')}
                />
              ),
            })}
          </li>
        </VStack>
        <Typography variant="panelInfo">
          {t.rich('evenMore', {
            templateVersionButton: () => (
              <GenericPanelOpener
                panelId="deployment"
                title={t('templateVersionButton')}
              />
            ),
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
