import { createPanelManager } from '@letta-web/component-library';
import { agentSimulatorTemplate } from './AgentSimulator/AgentSimulator';
import { archivalMemoriesPanelTemplate } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { configPanelTemplate } from './ConfigPanel/ConfigPanelWrapped';
import { welcomePanelTemplate } from './WelcomePanel/WelcomePanel';
import { modelTemplate } from './ModelPanel/ModelPanel';
import { toolsPanelTemplate } from './ToolsPanel/ToolsPanel';
import { deploymentPanelTemplate } from './TemplateVersionManager/TemplateVersionManager';
import { agentSidebarTemplate } from './ADESidebar/ADESidebar';
import { editMemoryBlocksTemplate } from './EditMemoryBlockPanel/EditMemoryBlockPanel';
import { editDataSourcesPanel } from './EditDataSourcesPanel/EditDataSourcesPanel';
import { deployedAgentsPanel } from './DeployedAgentsPanel/DeployedAgentsPanel';

const {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelToggle,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
} = createPanelManager({
  'model-details': modelTemplate,
  'agent-simulator': agentSimulatorTemplate,
  'archival-memories': archivalMemoriesPanelTemplate,
  'agent-config': configPanelTemplate,
  'welcome-panel': welcomePanelTemplate,
  'tools-panel': toolsPanelTemplate,
  deployment: deploymentPanelTemplate,
  'edit-memory-block': editMemoryBlocksTemplate,
  sidebar: agentSidebarTemplate,
  'edit-data-source': editDataSourcesPanel,
  'deployed-agents': deployedAgentsPanel,
});

export {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelToggle,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
};
