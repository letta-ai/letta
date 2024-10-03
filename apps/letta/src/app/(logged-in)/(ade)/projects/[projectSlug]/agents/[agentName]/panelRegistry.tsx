import { createPanelManager } from '@letta-web/component-library';
import { agentSimulatorTemplate } from './AgentSimulator/AgentSimulator';
import { archivalMemoriesPanelTemplate } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { configPanelTemplate } from './ConfigPanel/ConfigPanelWrapped';
import { welcomePanelTemplate } from './WelcomePanel/WelcomePanel';
import { modelTemplate } from './ModelPanel/ModelPanel';
import { toolsPanelTemplate } from './ToolsPanel/ToolsPanel';
import { dataSourcesPanelTemplate } from './DataSourcesPanel/DataSourcesPanel';
import { memoryBlocksTemplate } from './MemoryBlocksPanel/MemoryBlocksPanel';
import { deploymentPanelTemplate } from './DeploymentAgentMangerPanel/DeploymentAgentMangerPanel';
import { agentSidebarTemplate } from './ADESidebar/ADESidebar';
import { editMemoryBlocksTemplate } from './EditMemoryBlockPanel/EditMemoryBlockPanel';

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
  'data-sources-panel': dataSourcesPanelTemplate,
  'memory-blocks': memoryBlocksTemplate,
  deployment: deploymentPanelTemplate,
  'edit-memory-block': editMemoryBlocksTemplate,
  sidebar: agentSidebarTemplate,
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
