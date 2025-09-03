import { useMemo } from 'react';

export interface Rule {
  tool_name?: string;
  type?: string;
  children?: string[];
  max_count_limit?: number;
}

interface Tool {
  name?: string | null; // Allow null to match SDK type
}

interface Agent {
  tools?: Tool[];
  tool_rules?: Rule[] | null; // Allow null to match SDK type
}

// Update useMergedToolData to handle null gracefully
export function useMergedToolData(agent: Agent | null) {
  return useMemo(() => {
    if (!agent?.tools) return [];

    const toolRulesMap = new Map<string, Rule[]>();

    // First, add all tool rules to the map (handle null case)
    agent.tool_rules?.forEach((rule: Rule) => {
      const key = rule.tool_name;
      if (key && !toolRulesMap.has(key)) {
        toolRulesMap.set(key, []);
      }
      if (key) {
        toolRulesMap.get(key)?.push(rule);
      }
    });

    // Then, ensure all tools have entries in the map (even if no rules)
    agent.tools.forEach((tool: Tool) => {
      const toolName = tool.name;
      if (toolName && !toolRulesMap.has(toolName)) {
        toolRulesMap.set(toolName, []);
      }
    });

    // Convert map to array of rules
    const allRules: Rule[] = [];
    toolRulesMap.forEach((rules, toolName) => {
      if (rules.length > 0) {
        allRules.push(...rules);
      } else {
        // Add a default rule for tools without explicit rules
        allRules.push({ tool_name: toolName });
      }
    });

    return allRules;
  }, [agent?.tools, agent?.tool_rules]);
}
