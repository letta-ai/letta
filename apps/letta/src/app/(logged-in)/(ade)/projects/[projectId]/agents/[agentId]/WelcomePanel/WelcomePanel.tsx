import type { PanelRegistryItem } from '@letta-web/component-library';
import { PanelMainContent, Typography } from '@letta-web/component-library';
import { z } from 'zod';

function WelcomePanel() {
  return (
    <PanelMainContent>
      <Typography variant="heading2">Welcome to the Letta ADE!</Typography>
      <Typography>
        The Letta Agent Development Environment provides you tools to easily
        configure, test and deploy an agent.
      </Typography>
      <Typography>
        We have setup a sample agent for you that simulates a Wizard conversing
        with a specific user
      </Typography>
      <Typography>
        If you want to experience a different agent reciepie
      </Typography>
    </PanelMainContent>
  );
}

export const welcomePanelTemplate = {
  templateId: 'welcome-panel',
  content: WelcomePanel,
  title: 'Welcome',
  data: z.undefined(),
} satisfies PanelRegistryItem<'welcome-panel'>;
