import type {
  SupportedToolRuleTypes,
  ToolGroup,
  EdgeOpacityParams,
  EdgeContext,
  NODE_OPACITY,
  CONTROL_NODES,
} from '../types';
import { isChildRule } from './ruleGuards';

// Basic grouping utility
export function groupToolRules(rules: SupportedToolRuleTypes[]): ToolGroup {
  return rules.reduce((groups, rule) => {
    const name = rule.tool_name;
    if (!groups[name]) groups[name] = [];
    groups[name].push(rule);
    return groups;
  }, {} as ToolGroup);
}

// Add missing child tools to the groups
export function addMissingChildTools(toolGroups: ToolGroup): void {
  const allChildTools = new Set<string>();
  Object.values(toolGroups).forEach((ruleList) => {
    ruleList.filter(isChildRule).forEach((r) => {
      r.children.forEach((child) => allChildTools.add(child));
    });
  });

  allChildTools.forEach((childTool) => {
    if (!toolGroups[childTool]) {
      toolGroups[childTool] = [{ tool_name: childTool, type: 'continue_loop' }];
    }
  });
}

// Categorize tools into different types
export function categorizeTools(toolGroups: ToolGroup) {
  const uniqueTools = Object.keys(toolGroups);
  const childTools = new Set<string>();

  Object.values(toolGroups).forEach((ruleList) => {
    ruleList.filter(isChildRule).forEach((r) => {
      r.children.forEach((child) => {
        childTools.add(child);
      });
    });
  });

  const runFirstTools = uniqueTools.filter(
    (toolName) =>
      toolGroups[toolName].some((rule) => rule.type === 'run_first') &&
      !childTools.has(toolName),
  );

  const exitLoopTools = uniqueTools.filter(
    (toolName) =>
      toolGroups[toolName].some((rule) => rule.type === 'exit_loop') &&
      !childTools.has(toolName),
  );

  const otherTools = uniqueTools.filter((toolName) => {
    const rules = toolGroups[toolName];
    const hasRunFirst = rules.some((r) => r.type === 'run_first');
    const hasExitLoop = rules.some((r) => r.type === 'exit_loop');
    return !hasRunFirst && !hasExitLoop && !childTools.has(toolName);
  });

  return { runFirstTools, exitLoopTools, otherTools, childTools };
}

// Get count of outward edges for a tool (Unused atm)
export function getOutwardEdgeCount(
  toolName: string,
  toolGroups: ToolGroup,
): number {
  const rules = toolGroups[toolName];
  let count = 0;

  const isParent = rules.some((r) => r.type === 'constrain_child_tools');
  const hasExitLoop = rules.some((r) => r.type === 'exit_loop');
  const hasNoType = rules.length === 0 || rules.every((r) => !r.type);
  const constrainRule = rules.find(isChildRule);

  if (hasExitLoop || hasNoType) count++;
  if (hasNoType || (!hasExitLoop && !isParent)) count++;
  if (constrainRule?.children) count += constrainRule.children.length;

  return count;
}

// Edge opacity calculation logic
export function getEdgeOpacity(
  params: EdgeOpacityParams,
  context: EdgeContext,
): number {
  const { sourceToolName, targetToolName, edgeType } = params;
  const { focusedTool, rulesData } = context;

  if (!focusedTool) return 0.5;
  if (focusedTool === 'agent' && sourceToolName === null) return 1;
  if (focusedTool === 'done' && targetToolName === null && edgeType === 'exit')
    return 1;

  // 1) child-edge highlight for constrain ALWAYS at 0.9
  if (edgeType === 'constrain') {
    const toolGroups = groupToolRules(rulesData);
    const focusedRules = toolGroups[focusedTool] || [];
    const constrainRule = focusedRules.find(isChildRule);
    const children = constrainRule?.children ?? [];

    if (
      (sourceToolName && children.includes(sourceToolName)) ||
      (targetToolName && children.includes(targetToolName))
    ) {
      return 0.9;
    }
  }

  // 2) now fallback to “exact focus ⇒ 1”
  if (sourceToolName === focusedTool || targetToolName === focusedTool) {
    return 1;
  }

  // 3) all other child edges (shouldn’t hit for constrain) or non-focused edges
  const toolGroups = groupToolRules(rulesData);
  const focusedRules = toolGroups[focusedTool] || [];
  const constrainRule = focusedRules.find(isChildRule);
  const constrainChildren = constrainRule?.children ?? [];

  const hasSourceInChildren = sourceToolName
    ? constrainChildren.includes(sourceToolName)
    : false;
  const hasTargetInChildren = targetToolName
    ? constrainChildren.includes(targetToolName)
    : false;

  return hasSourceInChildren || hasTargetInChildren ? 0.9 : 0.1;
}

// Arrow color calculation
export function getArrowColor(
  sourceIsFocused: boolean,
  targetIsFocused: boolean,
  colors: { OUTGOING: string; INCOMING: string; DEFAULT: string },
): string {
  if (sourceIsFocused) return colors.OUTGOING;
  if (targetIsFocused) return colors.INCOMING;
  return colors.DEFAULT;
}

// Node opacity calculations - combine parameters into single object
export function getControlNodeOpacity(params: {
  toolName: string;
  focusedTool: string;
  toolGroups: ToolGroup;
  constants: {
    CONTROL_NODES: typeof CONTROL_NODES;
    NODE_OPACITY: typeof NODE_OPACITY;
  };
}): number {
  const { toolName, focusedTool, toolGroups, constants } = params;
  const { CONTROL_NODES, NODE_OPACITY } = constants;

  if (toolName === CONTROL_NODES.AGENT) {
    const focusedRules = toolGroups[focusedTool] || [];
    const hasExit = focusedRules.some((r) => r.type === 'exit_loop');
    const hasNoType =
      focusedRules.length === 0 || focusedRules.every((r) => !r.type);
    const isParent = focusedRules.some(
      (r) => r.type === 'constrain_child_tools',
    );

    return hasNoType || (!hasExit && !isParent)
      ? NODE_OPACITY.FULL
      : NODE_OPACITY.DEFAULT;
  }

  if (toolName === CONTROL_NODES.DONE) {
    const focusedRules = toolGroups[focusedTool] || [];
    const hasExit = focusedRules.some((r) => r.type === 'exit_loop');
    const hasNoType =
      focusedRules.length === 0 || focusedRules.every((r) => !r.type);

    return hasExit || hasNoType ? NODE_OPACITY.FULL : NODE_OPACITY.DEFAULT;
  }

  return 0.4;
}

export function getToolNodeOpacity(params: {
  toolName: string;
  focusedTool: string;
  toolGroups: ToolGroup;
  constants: { CONTROL_NODES: typeof CONTROL_NODES };
}): number {
  const { toolName, focusedTool, toolGroups, constants } = params;
  const { CONTROL_NODES } = constants;

  if (focusedTool === CONTROL_NODES.AGENT) return 0.9;

  if (focusedTool === CONTROL_NODES.DONE) {
    const rules = toolGroups[toolName] || [];
    const hasExit = rules.some((r) => r.type === 'exit_loop');
    const hasNoType = rules.length === 0 || rules.every((r) => !r.type);
    return hasExit || hasNoType ? 0.9 : 0.4;
  }

  const focusedRules = toolGroups[focusedTool] || [];
  const currentRules = toolGroups[toolName] || [];

  const focusedConstrainRule = focusedRules.find(isChildRule);
  if (focusedConstrainRule?.children.includes(toolName)) return 0.9;

  const currentConstrainRule = currentRules.find(isChildRule);
  if (currentConstrainRule?.children.includes(focusedTool)) return 0.9;

  return 0.4;
}

export function getNodeOpacity(params: {
  toolName: string;
  nodeType: 'control' | 'tool';
  focusedTool: string | null;
  toolGroups: ToolGroup;
  constants: {
    CONTROL_NODES: typeof CONTROL_NODES;
    NODE_OPACITY: typeof NODE_OPACITY;
  };
}): number {
  const { toolName, nodeType, focusedTool, toolGroups, constants } = params;

  if (!focusedTool) return 1;
  if (toolName === focusedTool) return 1;

  return nodeType === 'control'
    ? getControlNodeOpacity({ toolName, focusedTool, toolGroups, constants })
    : getToolNodeOpacity({
        toolName,
        focusedTool,
        toolGroups,
        constants: { CONTROL_NODES: constants.CONTROL_NODES },
      });
}

// Node background color logic - combine parameters into single object
export function getNodeBackgroundColor(params: {
  toolName: string;
  focusedTool: string | null;
  colors: {
    NODE: {
      AGENT_BACKGROUND: string;
      AGENT_BACKGROUND_DIM: string;
      DONE_BACKGROUND: string;
      DONE_BACKGROUND_DIM: string;
      TOOL_BACKGROUND: string;
      TOOL_BACKGROUND_DIM: string;
    };
  };
  controlNodes: { AGENT: string; DONE: string };
}): string {
  const { toolName, focusedTool, colors, controlNodes } = params;
  const isFocused = toolName === focusedTool;

  if (toolName === controlNodes.AGENT) {
    return isFocused
      ? colors.NODE.AGENT_BACKGROUND
      : colors.NODE.AGENT_BACKGROUND_DIM;
  }

  if (toolName === controlNodes.DONE) {
    return isFocused
      ? colors.NODE.DONE_BACKGROUND
      : colors.NODE.DONE_BACKGROUND_DIM;
  }

  return !focusedTool || isFocused
    ? colors.NODE.TOOL_BACKGROUND
    : colors.NODE.TOOL_BACKGROUND_DIM;
}

// Layout calculation for node columns
export function calculateNodeLayout(
  rules: SupportedToolRuleTypes[],
  layout: {
    AGENT_X: number;
    MAIN_TOOLS_X: number;
    CHILD_TOOLS_X: number;
    EXIT_LOOP_X: number;
    DONE_X: number;
    CONTROL_Y: number;
    NODE_SPACING: number;
  },
) {
  const toolGroups = groupToolRules(rules);
  addMissingChildTools(toolGroups);

  const { runFirstTools, exitLoopTools, otherTools, childTools } =
    categorizeTools(toolGroups);

  const hasChildTools = Array.from(childTools).length > 0;
  const offsetX = 200;

  const exitLoopX = hasChildTools
    ? layout.EXIT_LOOP_X
    : layout.EXIT_LOOP_X - offsetX;
  const doneX = hasChildTools ? layout.DONE_X : layout.DONE_X - offsetX;

  return {
    toolGroups,
    runFirstTools,
    exitLoopTools,
    otherTools,
    childTools: Array.from(childTools),
    hasChildTools,
    exitLoopX,
    doneX,
    layout: {
      columns: [
        {
          type: 'agent' as const,
          tools: runFirstTools,
          x: layout.AGENT_X,
          offset: 0,
          hasControlNode: true,
        },
        {
          type: 'main' as const,
          tools: otherTools,
          x: layout.MAIN_TOOLS_X,
          offset: -25,
          hasControlNode: false,
        },
        ...(hasChildTools
          ? [
              {
                type: 'child' as const,
                tools: Array.from(childTools),
                x: layout.CHILD_TOOLS_X,
                offset: 0,
                hasControlNode: false,
              },
            ]
          : []),
        {
          type: 'exit' as const,
          tools: exitLoopTools,
          x: exitLoopX,
          offset: 0,
          hasControlNode: false,
        },
        {
          type: 'done' as const,
          tools: [],
          x: doneX,
          offset: 0,
          hasControlNode: true,
        },
      ].filter((column) => column.tools.length > 0 || column.hasControlNode),
    },
  };
}

// Edge creation data structure - specify colors directly
export function createEdgeData(
  rules: SupportedToolRuleTypes[],
  focusedTool: string | null = null,
) {
  const toolGroups = groupToolRules(rules);
  addMissingChildTools(toolGroups);
  const uniqueTools = Object.keys(toolGroups);
  const context: EdgeContext = { focusedTool, rulesData: rules };

  const edgeData: Array<{
    id: string;
    source: string;
    target: string;
    edgeType: 'agent_to_tool' | 'constrain' | 'continue' | 'exit';
    opacity: number;
    shouldDash: boolean;
    arrowColor: string;
  }> = [];

  uniqueTools.forEach((toolName) => {
    const rules = toolGroups[toolName];
    const outwardEdgeCount = getOutwardEdgeCount(toolName, toolGroups);
    const shouldDashOutward = outwardEdgeCount > 1;

    // Agent → Tool connections
    edgeData.push({
      id: `agent-${toolName}`,
      source: 'agent',
      target: `tool-${toolName}`,
      edgeType: 'agent_to_tool',
      opacity: getEdgeOpacity(
        {
          sourceToolName: null,
          targetToolName: toolName,
          edgeType: 'agent_to_tool',
        },
        context,
      ),
      shouldDash: false,
      arrowColor: getArrowColor(
        focusedTool === 'agent',
        focusedTool === toolName,
        {
          OUTGOING: 'hsl(var(--brand))',
          INCOMING: 'hsl(var(--brand))',
          DEFAULT: '',
        },
      ),
    });

    const isParent = rules.some((r) => r.type === 'constrain_child_tools');
    const hasExitLoop = rules.some((r) => r.type === 'exit_loop');
    const hasNoType = rules.length === 0 || rules.every((r) => !r.type);

    // Exit connections
    if (hasExitLoop || hasNoType) {
      edgeData.push({
        id: `${toolName}-done`,
        source: `tool-${toolName}`,
        target: 'done',
        edgeType: 'exit',
        opacity: getEdgeOpacity(
          { sourceToolName: toolName, targetToolName: null, edgeType: 'exit' },
          context,
        ),
        shouldDash: shouldDashOutward,
        arrowColor: getArrowColor(
          focusedTool === toolName,
          focusedTool === 'done',
          {
            OUTGOING: 'hsl(var(--brand))',
            INCOMING: 'hsl(var(--brand))',
            DEFAULT: '',
          },
        ),
      });
    }

    // Continue connections
    if (hasNoType || (!hasExitLoop && !isParent)) {
      edgeData.push({
        id: `${toolName}-agent`,
        source: `tool-${toolName}`,
        target: 'agent',
        edgeType: 'continue',
        opacity: getEdgeOpacity(
          {
            sourceToolName: toolName,
            targetToolName: null,
            edgeType: 'continue',
          },
          context,
        ),
        shouldDash: shouldDashOutward,
        arrowColor: getArrowColor(focusedTool === toolName, false, {
          OUTGOING: 'hsl(var(--brand))',
          INCOMING: 'hsl(var(--brand))',
          DEFAULT: '',
        }),
      });
    }

    // Parent → Child relationships
    const constrainRule = rules.find(isChildRule);
    constrainRule?.children.forEach((childTool) => {
      if (toolGroups[childTool]) {
        edgeData.push({
          id: `${toolName}-${childTool}`,
          source: `tool-${toolName}`,
          target: `tool-${childTool}`,
          edgeType: 'constrain',
          opacity: getEdgeOpacity(
            {
              sourceToolName: toolName,
              targetToolName: childTool,
              edgeType: 'constrain',
            },
            context,
          ),
          shouldDash: shouldDashOutward,
          arrowColor: getArrowColor(
            focusedTool === toolName,
            focusedTool === childTool,
            {
              OUTGOING: 'hsl(var(--brand))',
              INCOMING: 'hsl(var(--brand))',
              DEFAULT: '',
            },
          ),
        });
      }
    });
  });

  return edgeData;
}
