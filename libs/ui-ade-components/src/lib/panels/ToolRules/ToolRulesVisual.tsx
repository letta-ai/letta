'use client';
import React, { useCallback, useState, useEffect } from 'react';
import { useMergedToolData } from './hooks/useMergedToolData';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './ToolRules.scss';

// Import icon components from UI library
import {
  StartIcon,
  ConstrainChildToolsIcon,
  MaxCountPerStepIcon,
  ContinueLoopIcon,
  EndIcon,
  LoadingEmptyStatusComponent,
  CaretDownIcon,
  CaretRightIcon,
} from '@letta-cloud/ui-component-library';

// Import types from consolidated types file
import type {
  SupportedToolRuleTypes,
  ToolColumn,
  EdgeParams,
  ToolNodeParams,
  ControlNodeParams,
} from './types';

// Import constants from types (but not RULE_ICON_PATHS since we're using components)
import {
  COLORS,
  FONT_SIZES,
  LAYOUT,
  CONTROL_NODES,
  NODE_OPACITY,
} from './types';

// Utility Functions
import { getTextWidth, getCenteredYPositions } from './utils/layoutUtils';
import {
  groupToolRules,
  addMissingChildTools,
  categorizeTools,
  getNodeOpacity,
  createEdgeData,
} from './utils/graphUtils';

import { isMaxCountRule } from './utils/ruleGuards';
import { useTranslations } from 'next-intl';
import type { AgentState, Tool } from '@letta-cloud/sdk-core';

function getNodeBackgroundColor(
  toolName: string,
  focusedTool: string | null,
): string {
  const isFocused = toolName === focusedTool;

  if (toolName === CONTROL_NODES.START) {
    return isFocused
      ? COLORS.NODE.START_BACKGROUND
      : COLORS.NODE.START_BACKGROUND_DIM;
  }

  if (toolName === CONTROL_NODES.AGENT) {
    return isFocused
      ? COLORS.NODE.AGENT_BACKGROUND
      : COLORS.NODE.AGENT_BACKGROUND_DIM;
  }

  if (toolName === CONTROL_NODES.DONE) {
    return isFocused
      ? COLORS.NODE.DONE_BACKGROUND
      : COLORS.NODE.DONE_BACKGROUND_DIM;
  }

  return !focusedTool || isFocused
    ? COLORS.NODE.TOOL_BACKGROUND
    : COLORS.NODE.TOOL_BACKGROUND_DIM;
}

// Updated Icon Components using @letta-cloud/ui-component-library
function getRuleTypeIcons(
  rules: SupportedToolRuleTypes[],
): React.ReactElement[] {
  const iconConfigs = [
    {
      type: 'run_first',
      icon: <StartIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.RUN_FIRST,
    },
    {
      type: 'constrain_child_tools',
      icon: <ConstrainChildToolsIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.CONSTRAIN,
    },
    {
      type: 'max_count_per_step',
      icon: <MaxCountPerStepIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.MAX_COUNT,
    },
    {
      type: 'continue_loop',
      icon: <ContinueLoopIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.CONTINUE,
    },
    {
      type: 'exit_loop',
      icon: <EndIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.EXIT,
    },
    {
      type: 'required_before_exit',
      icon: <EndIcon size="small" color="inherit" />,
      color: COLORS.RULE_ICONS.REQUIRED_BEFORE_EXIT,
    },
  ];

  return iconConfigs
    .filter(({ type }) => rules.some((r) => r.type === type))
    .map(({ type, icon, color }) => (
      <div
        key={type}
        style={{
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
    ));
}

// Node Creation Functions

// 1) TYPE-GUARDS

function createToolNode(params: ToolNodeParams): Node {
  const { toolName, rules, position, focusedTool, toolGroups } = params;

  // find and narrow
  const maxCountRule = rules.find(isMaxCountRule);
  const maxCountLimit = maxCountRule?.max_count_limit;

  // icons for any rule types
  const icons = getRuleTypeIcons(rules);

  // Calculate width based on tool name and number of icons
  const baseWidth = getTextWidth(toolName, 14);
  const iconWidth = icons.length * 16;
  const calculatedWidth = Math.max(baseWidth + iconWidth, 120);

  return {
    id: `tool-${toolName}`,
    position,
    data: {
      label: (
        <div className="tool-node__container">
          <div className="tool-node__header">
            {icons.length > 0 && (
              <div className="tool-node__icons">{icons}</div>
            )}
            <div className="tool-node__name">{toolName}</div>
          </div>

          {/* now you can simply check maxCountLimit */}
          {maxCountLimit != null && (
            <div className="tool-node__max-count">Max: {maxCountLimit}</div>
          )}
        </div>
      ),
      toolName,
      rules,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      background: getNodeBackgroundColor(toolName, focusedTool),
      border: `1px solid ${COLORS.NODE.BORDER}`,
      width: `${calculatedWidth}px`,
      opacity: getNodeOpacity({
        toolName,
        nodeType: 'tool',
        focusedTool,
        toolGroups,
        constants: { CONTROL_NODES, NODE_OPACITY },
      }),
    },
    className: `tool-node ${maxCountLimit != null ? 'tool-node--with-max-count' : ''}`,
  };
}

function createControlNode(params: ControlNodeParams): Node {
  const { id, label, x, borderColor, focusedTool, toolGroups } = params;
  return {
    id,
    position: { x, y: LAYOUT.CONTROL_Y },
    data: { label, nodeType: 'control', toolName: id },
    sourcePosition: Position.Right,
    targetPosition:
      id === CONTROL_NODES.AGENT ? Position.Bottom : Position.Left,
    style: {
      background: getNodeBackgroundColor(id, focusedTool),
      border: `1px solid ${borderColor}`,
      borderRadius: '4px',
      fontSize: FONT_SIZES.CONTROL_NODE,
      fontWeight: '600',
      textAlign: 'center',
      width: `${Math.max(getTextWidth(label, 12), 100)}px`,
      height: '30px',
      opacity: getNodeOpacity({
        toolName: id,
        nodeType: 'control',
        focusedTool,
        toolGroups,
        constants: { CONTROL_NODES, NODE_OPACITY },
      }),
      cursor: 'pointer',
      transition: 'all 0.05s ease',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '80px',
    },
  };
}

function createNodesFromRules(
  rules: SupportedToolRuleTypes[],
  focusedTool: string | null = null,
): Node[] {
  const toolGroups = groupToolRules(rules);
  addMissingChildTools(toolGroups);

  const { runFirstTools, exitLoopTools, otherTools, childTools } =
    categorizeTools(toolGroups);

  // Check if children array is empty
  const hasChildTools = Array.from(childTools).length > 0;

  const offsetX = 200; // Offset for child tools

  const exitLoopX = hasChildTools
    ? LAYOUT.EXIT_LOOP_X
    : LAYOUT.EXIT_LOOP_X - offsetX;
  const doneX = hasChildTools ? LAYOUT.DONE_X : LAYOUT.DONE_X - offsetX;

  // Create separate START and AGENT control nodes
  const startNode = createControlNode({
    id: CONTROL_NODES.START,
    label: 'Start',
    x: LAYOUT.AGENT_X, // Original position
    borderColor: COLORS.NODE.START_BORDER,
    focusedTool,
    toolGroups,
  });

  const agentNode = createControlNode({
    id: CONTROL_NODES.AGENT,
    label: 'Agent',
    x: LAYOUT.AGENT_X, // Original position (will be shifted later)
    borderColor: COLORS.NODE.AGENT_BORDER,
    focusedTool,
    toolGroups,
  });

  const doneNode = createControlNode({
    id: CONTROL_NODES.DONE,
    label: 'Exit loop',
    x: doneX,
    borderColor: COLORS.NODE.DONE_BORDER,
    focusedTool,
    toolGroups,
  });

  // Update tool columns - combine START and AGENT in same column
  const toolColumns: ToolColumn[] = [
    {
      tools: [...runFirstTools],
      x: LAYOUT.AGENT_X,
      offset: 0,
      hasControlNode: true,
      controlNode: agentNode, // This will be handled specially
      startNode: startNode, // Add START node reference
    },
    {
      tools: otherTools,
      x: LAYOUT.MAIN_TOOLS_X,
      offset: -25,
      hasControlNode: false,
    },
    ...(hasChildTools
      ? [
          {
            tools: Array.from(childTools),
            x: LAYOUT.CHILD_TOOLS_X,
            offset: 0,
            hasControlNode: false,
          },
        ]
      : []),
    {
      tools: [...exitLoopTools],
      x: exitLoopX,
      offset: 0,
      hasControlNode: false,
    },
  ].filter((column) => column.tools.length > 0 || column.hasControlNode);

  // Add done node as its own column
  const doneColumn: ToolColumn = {
    tools: [],
    x: doneX,
    offset: 0,
    hasControlNode: true,
    controlNode: doneNode,
  };
  toolColumns.push(doneColumn);

  const allNodes: Node[] = [];

  toolColumns.forEach(
    ({ tools, x, offset, hasControlNode, controlNode, startNode }) => {
      if (hasControlNode && controlNode && controlNode.id === 'done') {
        // Position the done node based on the number of exit loop tools
        const exitLoopToolCount = exitLoopTools.length;
        const doneYOffset =
          exitLoopToolCount > 0 ? exitLoopToolCount * LAYOUT.NODE_SPACING : 0;
        controlNode.position = { x, y: LAYOUT.CONTROL_Y + doneYOffset };
        allNodes.push(controlNode);
      } else if (hasControlNode && controlNode && startNode) {
        // Special handling for START + AGENT column
        const totalItems = tools.length + 2; // +2 for START and AGENT nodes
        const yPositions = getCenteredYPositions(totalItems);

        // Position START node at the top
        startNode.position = { x, y: yPositions[0] };
        allNodes.push(startNode);

        // Position tools after START but before AGENT
        tools.forEach((toolName, index) => {
          const rules = toolGroups[toolName] || [
            { tool_name: toolName, type: 'continue_loop' },
          ];
          const position = { x: x + offset, y: yPositions[index + 1] }; // +1 to skip START position
          allNodes.push(
            createToolNode({
              toolName,
              rules,
              position,
              focusedTool,
              toolGroups,
            }),
          );
        });

        // Position AGENT node at the end - shift it 50px to the right
        const agentYPosition = yPositions[yPositions.length - 1];
        controlNode.position = { x: x, y: agentYPosition }; // Shift AGENT node to the right
        allNodes.push(controlNode);
      } else if (hasControlNode && controlNode) {
        // Regular control node handling
        const totalItems = tools.length + 1;
        const yPositions = getCenteredYPositions(totalItems);

        controlNode.position = { x, y: yPositions[0] };
        allNodes.push(controlNode);

        // Position tools starting from the second position
        tools.forEach((toolName, index) => {
          const rules = toolGroups[toolName] || [
            { tool_name: toolName, type: 'continue_loop' },
          ];
          const position = { x: x + offset, y: yPositions[index + 1] };
          allNodes.push(
            createToolNode({
              toolName,
              rules,
              position,
              focusedTool,
              toolGroups,
            }),
          );
        });
      } else {
        // Regular column without control node
        const yPositions = getCenteredYPositions(tools.length);
        tools.forEach((toolName, index) => {
          const rules = toolGroups[toolName] || [
            { tool_name: toolName, type: 'continue_loop' },
          ];
          const position = { x: x + offset, y: yPositions[index] };
          allNodes.push(
            createToolNode({
              toolName,
              rules,
              position,
              focusedTool,
              toolGroups,
            }),
          );
        });
      }
    },
  );

  return allNodes;
}

// Edge Creation Functions
function createEdge(params: EdgeParams): Edge {
  const {
    id,
    source,
    target,
    arrowColor,
    opacity,
    shouldDash = false,
    data = {},
  } = params;
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    markerEnd: {
      type: 'arrowclosed',
      width: 20,
      height: 20,
      color: arrowColor,
    },
    style: {
      stroke: arrowColor,
      strokeWidth: 1,
      opacity,
      ...(shouldDash && {
        strokeDasharray: '8,2',
        animation: 'dashdraw 0.7s linear infinite',
      }),
    },
    ...(data as any),
    data,
  };
}

function createEdgesFromRules(
  rules: SupportedToolRuleTypes[],
  focusedTool: string | null = null,
): Edge[] {
  const edgeData = createEdgeData(rules, focusedTool);

  return edgeData.map((edgeInfo) => {
    const { id, source, target, opacity } = edgeInfo;

    // Extract focus state and calculate arrow color here :D
    const sourceIsFocused =
      focusedTool ===
      (source === 'start'
        ? 'start' // Handle START node
        : source === 'agent'
          ? 'agent' // Handle AGENT node
          : source.replace('tool-', '')); // Handle tool nodes

    const targetIsFocused =
      focusedTool ===
      (target === 'start'
        ? 'start' // Handle START node
        : target === 'agent'
          ? 'agent' // Handle AGENT node
          : target === 'done'
            ? 'done' // Handle DONE node
            : target.replace('tool-', '')); // Handle tool nodes

    const arrowColor =
      sourceIsFocused || targetIsFocused
        ? COLORS.ARROW.INCOMING // Incoming and outgoing edges currently use the same color
        : COLORS.ARROW.DEFAULT;

    // Only show dash animation when a node is focused AND this edge is connected to it
    const shouldShowDash =
      focusedTool !== null && (sourceIsFocused || targetIsFocused);

    return createEdge({
      id,
      source,
      target,
      arrowColor,
      opacity,
      shouldDash: shouldShowDash,
    });
  });
}

// Updated Legend component using icon components
function Legend({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('ADE/ToolRulesVisual');
  return (
    <div className="tool-rules-legend">
      {/* Toggle Button */}
      <button onClick={onToggle} className="tool-rules-legend__toggle">
        <span>{t('ruleTypes')}</span>
        <span className="tool-rules-legend__toggle-icon">
          {isVisible ? <CaretDownIcon /> : <CaretRightIcon />}
        </span>
      </button>

      {/* Legend Content */}
      {isVisible && (
        <div className="tool-rules-legend__content">
          <div className="tool-rules-legend__grid">
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.RUN_FIRST }}>
                <StartIcon size="small" color="inherit" />
              </div>
              <span>{t('runFirst')}</span>
            </div>
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.CONSTRAIN }}>
                <ConstrainChildToolsIcon size="small" color="inherit" />
              </div>
              <span>{t('constrain')}</span>
            </div>
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.MAX_COUNT }}>
                <MaxCountPerStepIcon size="small" color="inherit" />
              </div>
              <span>{t('maxCount')}</span>
            </div>
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.CONTINUE }}>
                <ContinueLoopIcon size="small" color="inherit" />
              </div>
              <span>{t('continueLoop')}</span>
            </div>
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.EXIT }}>
                <EndIcon size="small" color="inherit" />
              </div>
              <span>{t('exitLoop')}</span>
            </div>
            <div className="tool-rules-legend__item">
              <div style={{ color: COLORS.RULE_ICONS.REQUIRED_BEFORE_EXIT }}>
                <EndIcon size="small" color="inherit" />
              </div>
              <span>{t('RequiredBeforeExit')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Component
interface ToolRulesVisualProps {
  tools?: Tool[];
  toolRules?: AgentState['tool_rules']; // Allow null to match SDK type
}

export function ToolRulesVisual(props: ToolRulesVisualProps) {
  const { tools, toolRules } = props;
  const rulesDataRaw = useMergedToolData({
    tools: tools || [],
    tool_rules: toolRules || null,
  });
  // ensure TS sees these as the SDK rule types
  const rulesData = rulesDataRaw as SupportedToolRuleTypes[];

  const [focusedTool, setFocusedTool] = useState<string | null>(null);
  const [legendVisible, setLegendVisible] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    createNodesFromRules(rulesData, focusedTool),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    createEdgesFromRules(rulesData, focusedTool),
  );

  useEffect(() => {
    // Preserve existing node positions when updating
    setNodes((currentNodes) => {
      const newNodes = createNodesFromRules(rulesData, focusedTool);

      // Create a map of existing positions
      const existingPositions = new Map(
        currentNodes.map((node) => [node.id, node.position]),
      );

      // Apply existing positions to new nodes
      return newNodes.map((newNode) => ({
        ...newNode,
        position: existingPositions.get(newNode.id) || newNode.position,
      }));
    });

    setEdges(createEdgesFromRules(rulesData, focusedTool));
  }, [focusedTool, setNodes, setEdges, rulesData]);

  const onConnect = useCallback(
    (params: Parameters<typeof addEdge>[0]) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const targetTool = (node.data.toolName || node.id) as string;
    setFocusedTool((prev) => (prev === targetTool ? null : targetTool));
  }, []);

  if (!tools) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  const proOptions = { hideAttribution: true };

  return (
    <div className="tool-rules-visual">
      <Legend
        isVisible={legendVisible}
        onToggle={() => {
          setLegendVisible(!legendVisible);
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodesConnectable={false}
        nodesDraggable={true}
        elementsSelectable={false}
        fitView
        proOptions={proOptions}
      >
        <Controls className="tool-rules-visual__controls" />
        <Background gap={20} size={1} color="hsl(var(--muted))" />
      </ReactFlow>
    </div>
  );
}
