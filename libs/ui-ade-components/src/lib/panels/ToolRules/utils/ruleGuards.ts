import type {
  SupportedToolRuleTypes,
  ChildToolRule,
  MaxCountPerStepToolRule,
} from '../types';

// type‐guards for ToolRulesVisual.tsx
export function isChildRule(r: SupportedToolRuleTypes): r is ChildToolRule {
  return r.type === 'constrain_child_tools';
}

export function isMaxCountRule(
  r: SupportedToolRuleTypes,
): r is MaxCountPerStepToolRule {
  return r.type === 'max_count_per_step';
}
