import { createPanelManager } from '@letta-web/component-library';
import { agentSimulatorTemplate } from './AgentSimulator/AgentSimulator';
import { archivalMemoriesPanelTemplate } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { configPanelTemplate } from './ConfigPanel/ConfigPanelWrapped';
import { welcomePanelTemplate } from './WelcomePanel/WelcomePanel';
import { agentSettingsPanel } from './AgentSettingsPanel/AgentSettingsPanel';
import { toolsPanelTemplate } from './ToolsPanel/ToolsPanel';
import { deploymentPanelTemplate } from './TemplateVersionManager/TemplateVersionManager';
import { editCoreMemories } from './EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import { editDataSourcesPanel } from './EditDataSourcesPanel/EditDataSourcesPanel';
import { deployedAgentsPanel } from './DeployedAgentsPanel/DeployedAgentsPanel';
import { advancedSettingsPanel } from './AdvancedSettingsPanel/AdvancedSettingsPanel';

const {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelToggle,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
} = createPanelManager({
  'agent-settings': agentSettingsPanel,
  'advanced-settings': advancedSettingsPanel,
  'agent-simulator': agentSimulatorTemplate,
  'archival-memories': archivalMemoriesPanelTemplate,
  'agent-config': configPanelTemplate,
  'welcome-panel': welcomePanelTemplate,
  'tools-panel': toolsPanelTemplate,
  deployment: deploymentPanelTemplate,
  'edit-core-memories': editCoreMemories,
  'edit-data-sources': editDataSourcesPanel,
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
