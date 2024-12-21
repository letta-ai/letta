import { createPanelManager } from '@letta-web/component-library';
import { agentSimulatorTemplate } from './AgentSimulator/AgentSimulator';
import { archivalMemoriesPanelTemplate } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { agentSettingsPanel } from './AgentSettingsPanel/AgentSettingsPanel';
import { toolsPanelTemplate } from './ToolsPanel/ToolsPanel';
import { editCoreMemories } from './EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import { editDataSourcesPanel } from './EditDataSourcesPanel/EditDataSourcesPanel';
import { advancedSettingsPanel } from './AdvancedSettingsPanel/AdvancedSettingsPanel';
import { contextWindowPanel } from './ContextEditorPanel/ContextEditorPanel';

const {
  panelRegistry,
  usePanelManager,
  PanelManagerProvider,
  PanelToggle,
  PanelOpener,
  RenderSinglePanel,
  PanelCloser,
  PanelRenderer,
} = createPanelManager({
  'agent-settings': agentSettingsPanel,
  'context-window': contextWindowPanel,
  'advanced-settings': advancedSettingsPanel,
  'agent-simulator': agentSimulatorTemplate,
  'archival-memories': archivalMemoriesPanelTemplate,
  'tools-panel': toolsPanelTemplate,
  'edit-core-memories': editCoreMemories,
  'edit-data-sources': editDataSourcesPanel,
});

export {
  panelRegistry,
  usePanelManager,
  RenderSinglePanel,
  PanelManagerProvider,
  PanelToggle,
  PanelOpener,
  PanelCloser,
  PanelRenderer,
};
