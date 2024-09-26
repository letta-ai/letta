import { createPanelManager } from '@letta-web/component-library';
import { agentSimulatorTemplate } from './AgentSimulator/AgentSimulator';
import { archivalMemoriesPanelTemplate } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { configPanelTemplate } from './ConfigPanel/ConfigPanelWrapped';
import { welcomePanelTemplate } from './WelcomePanel/WelcomePanel';

const {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
} = createPanelManager({
  'agent-simulator': agentSimulatorTemplate,
  'archival-memories': archivalMemoriesPanelTemplate,
  'agent-config': configPanelTemplate,
  'welcome-panel': welcomePanelTemplate,
});

export {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
};
