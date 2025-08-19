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
  const hasNoType = rules.every((r) => !r.type || r.type === 'continue_loop');
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

  // Handle specific control node focused cases
  if (focusedTool === 'start' && edgeType === 'start_to_agent') return 1;
  if (focusedTool === 'start' && edgeType === 'start_to_tool') return 1;
  if (focusedTool === 'agent' && edgeType === 'start_to_agent') return 1;
  if (focusedTool === 'agent' && edgeType === 'agent_to_tool') return 1;
  if (focusedTool === 'done' && edgeType === 'exit') return 1;

  // Add this line to fade continue edges when done is focused
  if (focusedTool === 'done' && edgeType === 'continue') return 0.3;

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

  // 2) now fallback to "exact focus ⇒ 1"
  if (sourceToolName === focusedTool || targetToolName === focusedTool) {
    return 1;
  }

  // 3) all other child edges or non-focused edges
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

  return hasSourceInChildren || hasTargetInChildren ? 0.9 : 0.3;
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

  if (toolName === CONTROL_NODES.START) {
    const focusedRules = toolGroups[focusedTool] || [];
    const hasExit = focusedRules.some((r) => r.type === 'exit_loop');
    const hasNoType =
            focusedRules.every((r) => !r.type || r.type === 'continue_loop');
    const isParent = focusedRules.some(
      (r) => r.type === 'constrain_child_tools',
    );

    return hasNoType || (!hasExit && !isParent)
      ? NODE_OPACITY.FULL
      : NODE_OPACITY.DEFAULT;
  }

  if (toolName === CONTROL_NODES.AGENT) {
    const focusedRules = toolGroups[focusedTool] || [];
    const hasExit = focusedRules.some((r) => r.type === 'exit_loop');
    const hasNoType =
            focusedRules.every((r) => !r.type || r.type === 'continue_loop');
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
            focusedRules.every((r) => !r.type || r.type === 'continue_loop');

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

  if (focusedTool === CONTROL_NODES.START) return 0.9;
  if (focusedTool === CONTROL_NODES.AGENT) return 0.9;

  if (focusedTool === CONTROL_NODES.DONE) {
    const rules = toolGroups[toolName] || [];
    const hasExit = rules.some((r) => r.type === 'exit_loop');
    const hasMaxCount = rules.some((r) => r.type === 'max_count_per_step');

    // Check if tool has NO TYPE rules (truly empty or undefined types)
    const hasNoTypeRules =  rules.every((r) => !r.type);

    // Check if tool ONLY has continue_loop rules and nothing else
    const hasOnlyContinue =
      rules.length > 0 &&
      rules.every((r) => r.type === 'continue_loop') &&
      !hasExit &&
      !hasMaxCount;

    // Tools that can connect to exit should have high opacity:
    // 1. Tools with explicit exit_loop rules
    // 2. Tools with max_count_per_step rules
    // 3. Tools with no type rules (can exit by default)
    if (hasExit || hasMaxCount || hasNoTypeRules) return 0.9;

    // Fade tools that only have continue_loop (can't exit)
    if (hasOnlyContinue) return 0.4;

    // Default case
    return 0.4;
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
      START_BACKGROUND: string;
      START_BACKGROUND_DIM: string;
      AGENT_BACKGROUND: string;
      AGENT_BACKGROUND_DIM: string;
      DONE_BACKGROUND: string;
      DONE_BACKGROUND_DIM: string;
      TOOL_BACKGROUND: string;
      TOOL_BACKGROUND_DIM: string;
    };
  };
  controlNodes: { START: string; AGENT: string; DONE: string };
}): string {
  const { toolName, focusedTool, colors, controlNodes } = params;
  const isFocused = toolName === focusedTool;

  if (toolName === controlNodes.START) {
    return isFocused
      ? colors.NODE.START_BACKGROUND
      : colors.NODE.START_BACKGROUND_DIM;
  }

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
          // offset: -25,
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

  // Get categorized tools to know which are run_first
  const { runFirstTools } = categorizeTools(toolGroups);

  const edgeData: Array<{
    id: string;
    source: string;
    target: string;
    edgeType:
      | 'agent_to_tool'
      | 'constrain'
      | 'continue'
      | 'exit'
      | 'start_to_agent'
      | 'start_to_tool';
    opacity: number;
    shouldDash: boolean;
    arrowColor: string;
  }> = [];

  // Conditional START connections
  if (runFirstTools.length > 0) {
    // If run_first tools exist, START → run_first tools
    runFirstTools.forEach((toolName) => {
      edgeData.push({
        id: `start-${toolName}`,
        source: 'start',
        target: `tool-${toolName}`,
        edgeType: 'start_to_tool',
        opacity: getEdgeOpacity(
          {
            sourceToolName: 'start',
            targetToolName: toolName,
            edgeType: 'start_to_tool',
          },
          context,
        ),
        shouldDash: false,
        arrowColor: getArrowColor(
          focusedTool === 'start',
          focusedTool === toolName,
          {
            OUTGOING: 'hsl(var(--brand))',
            INCOMING: 'hsl(var(--brand))',
            DEFAULT: 'hsl(var(--muted))',
          },
        ),
      });
    });
  } else {
    // Only create START → AGENT connection if no run_first tools exist
    edgeData.push({
      id: 'start-agent',
      source: 'start',
      target: 'agent',
      edgeType: 'start_to_agent',
      opacity: getEdgeOpacity(
        {
          sourceToolName: 'start',
          targetToolName: 'agent',
          edgeType: 'start_to_agent',
        },
        context,
      ),
      shouldDash: false,
      arrowColor: getArrowColor(
        focusedTool === 'start',
        focusedTool === 'agent',
        {
          OUTGOING: 'hsl(var(--brand))',
          INCOMING: 'hsl(var(--brand))',
          DEFAULT: 'hsl(var(--muted))',
        },
      ),
    });
  }

  uniqueTools.forEach((toolName) => {
    const rules = toolGroups[toolName];
    const isParent = rules.some((r) => r.type === 'constrain_child_tools');
    const hasExitLoop = rules.some((r) => r.type === 'exit_loop');
    const hasContinueLoop = rules.some((r) => r.type === 'continue_loop');
    const hasMaxCount = rules.some((r) => r.type === 'max_count_per_step');
    const hasRequiredBeforeExit = rules.some(
      (r) => r.type === 'required_before_exit',
    );
    const hasNoType =  rules.every((r) => !r.type);

    // AGENT → Tool connections for ALL tools (including run_first tools)
    edgeData.push({
      id: `agent-${toolName}`,
      source: 'agent',
      target: `tool-${toolName}`,
      edgeType: 'agent_to_tool',
      opacity: getEdgeOpacity(
        {
          sourceToolName: 'agent',
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
          DEFAULT: 'hsl(var(--muted))',
        },
      ),
    });

    // Exit connections
    if (
      (hasExitLoop || hasNoType || hasMaxCount || hasRequiredBeforeExit) &&
      !hasContinueLoop &&
      !isParent
    ) {
      edgeData.push({
        id: `${toolName}-done`,
        source: `tool-${toolName}`,
        target: 'done',
        edgeType: 'exit',
        opacity: getEdgeOpacity(
          {
            sourceToolName: toolName,
            targetToolName: 'done',
            edgeType: 'exit',
          },
          context,
        ),
        shouldDash: false,
        arrowColor: getArrowColor(
          focusedTool === toolName,
          focusedTool === 'done',
          {
            OUTGOING: 'hsl(var(--brand))',
            INCOMING: 'hsl(var(--brand))',
            DEFAULT: 'hsl(var(--muted))',
          },
        ),
      });
    }

    // Continue connections
    if (!isParent && (hasNoType || hasMaxCount || !hasExitLoop)) {
      edgeData.push({
        id: `${toolName}-agent`,
        source: `tool-${toolName}`,
        target: 'agent',
        edgeType: 'continue',
        opacity: getEdgeOpacity(
          {
            sourceToolName: toolName,
            targetToolName: 'agent',
            edgeType: 'continue',
          },
          context,
        ),
        shouldDash: false,
        arrowColor: getArrowColor(focusedTool === toolName, false, {
          OUTGOING: 'hsl(var(--brand))',
          INCOMING: 'hsl(var(--brand))',
          DEFAULT: 'hsl(var(--muted))',
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
          shouldDash: false,
          arrowColor: getArrowColor(
            focusedTool === toolName,
            focusedTool === childTool,
            {
              OUTGOING: 'hsl(var(--brand))',
              INCOMING: 'hsl(var(--brand))',
              DEFAULT: 'hsl(var(--muted))',
            },
          ),
        });
      }
    });
  });

  return edgeData;
}
