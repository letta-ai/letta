import type {
  AgentState,
  ContinueToolRule,
  ChildToolRule,
  ConditionalToolRule,
  InitToolRule,
  MaxCountPerStepToolRule,
  TerminalToolRule,
  RequiredBeforeExitToolRule,
  RequiresApprovalToolRule,
  ParentToolRule,
} from '@letta-cloud/sdk-core';
import type { Node } from '@xyflow/react';

// Re-export the supported tool rule types from SDK
export type SupportedToolRuleTypes =
  | ChildToolRule
  | ConditionalToolRule
  | ContinueToolRule
  | InitToolRule
  | MaxCountPerStepToolRule
  | ParentToolRule
  | RequiredBeforeExitToolRule
  | RequiresApprovalToolRule
  | TerminalToolRule;

export type {
  ContinueToolRule,
  ChildToolRule,
  ConditionalToolRule,
  InitToolRule,
  MaxCountPerStepToolRule,
  TerminalToolRule,
  RequiredBeforeExitToolRule,
  ParentToolRule,
  RequiresApprovalToolRule,
};

export type SupportedToolRuleNameTypes =
  | 'conditional'
  | 'constrain_child_tools'
  | 'continue_loop'
  | 'exit_loop'
  | 'max_count_per_step'
  | 'required_before_exit'
  | 'run_first'

// Control node types
export type ControlNodeType = 'agent' | 'done';
export type ToolName = string;

// Tool grouping
export type ToolGroup = Record<string, SupportedToolRuleTypes[]>;

// Tool rules from agent state
export type ToolRules = AgentState['tool_rules'];

// Interface for tool columns in layout
export interface ToolColumn {
  tools: string[];
  x: number;
  offset: number;
  hasControlNode: boolean;
  controlNode?: Node;
  startNode?: Node;
}

// Constants for control nodes
export const CONTROL_NODES = {
  START: 'start',
  AGENT: 'agent',
  DONE: 'done',
} as const;

// ===== CONSOLIDATED CONTEXT TYPES =====

// Universal context for focus and tool group operations
export interface ToolRuleContext {
  focusedTool: string | null;
  toolGroups: ToolGroup;
}

// Context specifically for edge calculations (when you need raw rules data)
export interface EdgeContext {
  focusedTool: string | null;
  rulesData: SupportedToolRuleTypes[];
}

// Parameters for opacity calculations
export interface OpacityCalculationParams {
  toolName: string;
  nodeType: 'control' | 'tool';
  focusedTool: string | null;
  toolGroups: ToolGroup;
}

// ===== FORM/EDITOR TYPES =====

// Base interface for tool rule editor props
export interface ToolEditorDefaultProps {
  onSubmit: (data: SupportedToolRuleTypes | SupportedToolRuleTypes[]) => void;
  onRemove: () => void;
}

// Wrapper component props
export interface ToolRuleItemWrapperProps {
  isValid: boolean;
  isDirty: boolean;
  type: SupportedToolRuleNameTypes;
  onRemove: () => void;
  children: React.ReactNode;
}

// Individual editor props interfaces
export interface StartConstraintToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: InitToolRule;
}

export interface ChildToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ChildToolRule;
}

export interface ConditionalToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: ConditionalToolRule;
}

export interface ContinueToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ContinueToolRule;
}

export interface ExitLoopToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: TerminalToolRule;
}

export interface RequiredBeforeExitToolEditorProps
  extends ToolEditorDefaultProps {
  defaultRule: RequiredBeforeExitToolRule;
}

export interface MaxCountPerStepToolRuleEditorProps
  extends ToolEditorDefaultProps {
  defaultRule: MaxCountPerStepToolRule;
}

// Form interfaces
export interface StartConstraintToolRuleForm {
  toolName: string;
  type: 'run_first';
}

export interface ChildToolRuleForm {
  toolName: string;
  type: 'constrain_child_tools';
  children: string[];
}

export interface ConditionalToolRuleForm {
  toolName: string;
  type: 'conditional';
  defaultChild: string;
  requireOutputMapping: boolean;
  childOutputMapping: Record<string, string>;
}

export interface ContinueToolRuleForm {
  toolName: string;
  type: 'continue_loop';
}

export interface ExitLoopToolRuleForm {
  toolName: string;
  type: 'exit_loop';
}

export interface RequiredBeforeExitToolRuleForm {
  toolName: string;
  type: 'required_before_exit';
}

export interface MaxCountPerStepToolRuleForm {
  toolName: string;
  type: 'max_count_per_step';
  maxCount: string; // String in form, converted to number on submit
}

// New rule button types
export interface NewRuleButtonProps {
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface NewToolRuleButtonProps {
  onSelect: (rule: SupportedToolRuleNameTypes) => void;
}

// Main component props
export interface ToolRulesListProps {
  defaultToolRules: SupportedToolRuleTypes[];
}

// ===== VISUAL COMPONENT TYPES =====

// Edge and node creation types
export interface EdgeOpacityParams {
  sourceToolName: string | null;
  targetToolName: string | null;
  edgeType: string;
}

export interface EdgeParams {
  id: string;
  source: string;
  target: string;
  arrowColor: string;
  opacity: number;
  shouldDash?: boolean;
  data?: Record<string, unknown>;
}

export interface ToolNodeParams {
  toolName: string;
  rules: SupportedToolRuleTypes[];
  position: { x: number; y: number };
  focusedTool: string | null;
  toolGroups: ToolGroup;
}

export interface ControlNodeParams {
  id: string;
  label: string;
  x: number;
  borderColor: string;
  focusedTool: string | null;
  toolGroups: ToolGroup;
}

// Legend component types
export interface LegendProps {
  isVisible: boolean;
  onToggle: () => void;
}

// ===== CONSTANTS AND VISUAL STYLING =====

export const COLORS = {
  ARROW: {
    DEFAULT: 'hsl(var(--text-lighter))',
    OUTGOING: 'hsl(var(--brand))',
    INCOMING: 'hsl(var(--brand))',
  },
  NODE: {
    START_BACKGROUND: 'var(--start-background)',
    START_BACKGROUND_DIM: 'var(--start-background-dim)',
    AGENT_BACKGROUND: 'var(--agent-background)',
    AGENT_BACKGROUND_DIM: 'var(--agent-background-dim)',
    DONE_BACKGROUND: 'var(--done-background)',
    DONE_BACKGROUND_DIM: 'var(--done-background-dim)',
    TOOL_BACKGROUND: 'hsl(var(--background))',
    TOOL_BACKGROUND_DIM: 'hsl(var(--background) / 0.7)',
    BORDER: 'var(--node-border)',
    START_BORDER: 'var(--start-border)',
    AGENT_BORDER: 'var(--agent-border)',
    DONE_BORDER: 'var(--done-border)',
  },
  RULE_ICONS: {
    RUN_FIRST: 'var(--rule-icon-run-first)',
    CONSTRAIN: 'var(--rule-icon-constrain)',
    MAX_COUNT: 'var(--rule-icon-max-count)',
    CONTINUE: 'var(--rule-icon-continue)',
    EXIT: 'var(--rule-icon-exit)',
    REQUIRED_BEFORE_EXIT: 'var(--rule-icon-required-before-exit)',
  },
} as const;

export const FONT_SIZES = {
  TOOL_NODE: 'var(--font-size-sm)',
  CONTROL_NODE: 'var(--font-size-xs)',
  MAX_COUNT: 'var(--font-size-xs)',
} as const;

export const LAYOUT = {
  AGENT_X: 0,
  RUN_FIRST_X: 100,
  MAIN_TOOLS_X: 275,
  CHILD_TOOLS_X: 550,
  EXIT_LOOP_X: 850,
  DONE_X: 875,
  CONTROL_Y: 0,
  NODE_SPACING: 100,
  NO_CHILD_OFFSET: 50,
} as const;

export const NODE_OPACITY = {
  DEFAULT: 0.7,
  HIGHLIGHT: 0.8,
  FULL: 1.0,
} as const;
