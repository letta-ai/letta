import {
  groupToolRules,
  addMissingChildTools,
  categorizeTools,
  getEdgeOpacity,
  createEdgeData,
} from './utils/graphUtils';
import type { SupportedToolRuleTypes, ToolGroup } from './types';

// Remove this unused import
// import { renderHook } from '@testing-library/react';

// Test the most critical utility functions
describe('ToolRules - Core Functions', () => {
  describe('groupToolRules', () => {
    it('should group rules by tool name', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'tool1', type: 'run_first' },
        { tool_name: 'tool1', type: 'max_count_per_step', max_count_limit: 5 },
        { tool_name: 'tool2', type: 'continue_loop' },
      ];

      const result = groupToolRules(rules);

      expect(result).toEqual({
        tool1: [
          { tool_name: 'tool1', type: 'run_first' },
          {
            tool_name: 'tool1',
            type: 'max_count_per_step',
            max_count_limit: 5,
          },
        ],
        tool2: [{ tool_name: 'tool2', type: 'continue_loop' }],
      });
    });

    it('should handle empty rules array', () => {
      const result = groupToolRules([]);
      expect(result).toEqual({});
    });
  });

  describe('addMissingChildTools', () => {
    it('should add missing child tools with continue_loop type', () => {
      const toolGroups: ToolGroup = {
        parent_tool: [
          {
            tool_name: 'parent_tool',
            type: 'constrain_child_tools',
            children: ['child1', 'child2'],
          },
        ],
        child1: [{ tool_name: 'child1', type: 'exit_loop' }],
      };

      addMissingChildTools(toolGroups);

      expect(toolGroups).toHaveProperty('child2');
      expect(toolGroups.child2).toEqual([
        { tool_name: 'child2', type: 'continue_loop' },
      ]);
    });

    it('should not modify existing child tools', () => {
      const toolGroups: ToolGroup = {
        parent_tool: [
          {
            tool_name: 'parent_tool',
            type: 'constrain_child_tools',
            children: ['existing_child'],
          },
        ],
        existing_child: [{ tool_name: 'existing_child', type: 'run_first' }],
      };

      const originalChild = [...toolGroups.existing_child];
      addMissingChildTools(toolGroups);

      expect(toolGroups.existing_child).toEqual(originalChild);
    });
  });

  describe('categorizeTools', () => {
    it('should categorize tools correctly', () => {
      const toolGroups: ToolGroup = {
        runFirst: [{ tool_name: 'runFirst', type: 'run_first' }],
        exitLoop: [{ tool_name: 'exitLoop', type: 'exit_loop' }],
        regular: [{ tool_name: 'regular', type: 'continue_loop' }],
        parent: [
          {
            tool_name: 'parent',
            type: 'constrain_child_tools',
            children: ['child'],
          },
        ],
        child: [{ tool_name: 'child', type: 'continue_loop' }],
      };

      const result = categorizeTools(toolGroups);

      expect(result.runFirstTools).toEqual(['runFirst']);
      expect(result.exitLoopTools).toEqual(['exitLoop']);
      expect(result.otherTools).toEqual(['regular', 'parent']);
      expect(Array.from(result.childTools)).toEqual(['child']);
    });

    it('should exclude child tools from main categories', () => {
      const toolGroups: ToolGroup = {
        parent: [
          {
            tool_name: 'parent',
            type: 'constrain_child_tools',
            children: ['childWithRunFirst'],
          },
        ],
        childWithRunFirst: [
          { tool_name: 'childWithRunFirst', type: 'run_first' },
        ],
      };

      const result = categorizeTools(toolGroups);

      expect(result.runFirstTools).toEqual([]);
      expect(result.otherTools).toEqual(['parent']);
      expect(Array.from(result.childTools)).toEqual(['childWithRunFirst']);
    });
  });

  describe('getEdgeOpacity', () => {
    const mockRulesData: SupportedToolRuleTypes[] = [
      { tool_name: 'tool1', type: 'run_first' },
      { tool_name: 'tool2', type: 'continue_loop' },
    ];

    it('should return 0.5 when no tool is focused', () => {
      const result = getEdgeOpacity(
        {
          sourceToolName: 'tool1',
          targetToolName: 'tool2',
          edgeType: 'continue',
        },
        { focusedTool: null, rulesData: mockRulesData },
      );

      expect(result).toBe(0.5);
    });

    it('should return 1 when agent is focused and source is null', () => {
      const result = getEdgeOpacity(
        {
          sourceToolName: null,
          targetToolName: 'tool1',
          edgeType: 'agent_to_tool',
        },
        { focusedTool: 'agent', rulesData: mockRulesData },
      );

      expect(result).toBe(1);
    });

    it('should return 1 when done is focused for exit edges', () => {
      const result = getEdgeOpacity(
        { sourceToolName: 'tool1', targetToolName: null, edgeType: 'exit' },
        { focusedTool: 'done', rulesData: mockRulesData },
      );

      expect(result).toBe(1);
    });

    it('should return 1 when source or target tool is focused', () => {
      const result = getEdgeOpacity(
        {
          sourceToolName: 'tool1',
          targetToolName: 'tool2',
          edgeType: 'continue',
        },
        { focusedTool: 'tool1', rulesData: mockRulesData },
      );

      expect(result).toBe(1);
    });

    it('should return 0.9 for child relationships when parent is focused', () => {
      const rulesWithChildren: SupportedToolRuleTypes[] = [
        {
          tool_name: 'parent',
          type: 'constrain_child_tools',
          children: ['child1'],
        },
        { tool_name: 'child1', type: 'continue_loop' },
      ];

      const result = getEdgeOpacity(
        {
          sourceToolName: 'parent',
          targetToolName: 'child1',
          edgeType: 'constrain',
        },
        { focusedTool: 'parent', rulesData: rulesWithChildren },
      );

      expect(result).toBe(0.9);
    });
  });

  describe('createEdgeData', () => {
    it('should create agent-to-tool edges for ALL tools including run_first', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'tool1', type: 'run_first' },
        { tool_name: 'tool2', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules);

      const agentEdges = result.filter((edge) => edge.source === 'agent');
      expect(agentEdges).toHaveLength(2); // Both tools get agent-to-tool edges
      expect(agentEdges.map((e) => e.target)).toEqual([
        'tool-tool1',
        'tool-tool2',
      ]);
    });

    it('should create start-to-tool edges for run_first tools', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'runFirstTool', type: 'run_first' },
      ];

      const result = createEdgeData(rules);

      const startToToolEdges = result.filter(
        (edge) => edge.source === 'start' && edge.target.startsWith('tool-'),
      );
      expect(startToToolEdges).toHaveLength(1);
      expect(startToToolEdges[0].target).toBe('tool-runFirstTool');
      expect(startToToolEdges[0].edgeType).toBe('start_to_tool');
    });

    it('should always create start-to-agent edge', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'tool1', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules);

      const startToAgentEdges = result.filter(
        (edge) => edge.source === 'start' && edge.target === 'agent',
      );
      expect(startToAgentEdges).toHaveLength(1);
      expect(startToAgentEdges[0].edgeType).toBe('start_to_agent');
    });

    it('should create exit edges for exit_loop tools without continue_loop', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'exitTool', type: 'exit_loop' },
      ];

      const result = createEdgeData(rules);

      const exitEdges = result.filter((edge) => edge.target === 'done');
      expect(exitEdges).toHaveLength(1);
      expect(exitEdges[0].source).toBe('tool-exitTool');
      expect(exitEdges[0].edgeType).toBe('exit');
    });

    it('should NOT create exit edges for tools with continue_loop', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'continueTool', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules);

      const exitEdges = result.filter((edge) => edge.target === 'done');
      expect(exitEdges).toHaveLength(0);
    });

    it('should create continue edges for continue_loop tools', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'continueTool', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules);

      const continueEdges = result.filter(
        (edge) => edge.target === 'agent' && edge.source.startsWith('tool-'),
      );
      expect(continueEdges).toHaveLength(1);
      expect(continueEdges[0].source).toBe('tool-continueTool');
      expect(continueEdges[0].edgeType).toBe('continue');
    });

    it('should create constrain edges for parent-child relationships', () => {
      const rules: SupportedToolRuleTypes[] = [
        {
          tool_name: 'parent',
          type: 'constrain_child_tools',
          children: ['child1', 'child2'],
        },
        { tool_name: 'child1', type: 'continue_loop' },
        { tool_name: 'child2', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules);

      const constrainEdges = result.filter(
        (edge) => edge.edgeType === 'constrain',
      );
      expect(constrainEdges).toHaveLength(2);
      expect(constrainEdges[0].source).toBe('tool-parent');
      expect(constrainEdges.map((e) => e.target)).toEqual([
        'tool-child1',
        'tool-child2',
      ]);
    });

    it('should handle tools with no type (both exit and continue edges)', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'noTypeTool' }, // No type specified
      ];

      const result = createEdgeData(rules);

      // Should create both exit and continue edges for tools with no type
      const exitEdges = result.filter(
        (edge) => edge.target === 'done' && edge.source === 'tool-noTypeTool',
      );
      const continueEdges = result.filter(
        (edge) => edge.target === 'agent' && edge.source === 'tool-noTypeTool',
      );

      expect(exitEdges).toHaveLength(1);
      expect(continueEdges).toHaveLength(1);
    });

    it('should handle max_count_per_step tools (both exit and continue edges)', () => {
      const rules: SupportedToolRuleTypes[] = [
        {
          tool_name: 'maxCountTool',
          type: 'max_count_per_step',
          max_count_limit: 3,
        },
      ];

      const result = createEdgeData(rules);

      // Should create both exit and continue edges for max_count tools
      const exitEdges = result.filter(
        (edge) => edge.target === 'done' && edge.source === 'tool-maxCountTool',
      );
      const continueEdges = result.filter(
        (edge) =>
          edge.target === 'agent' && edge.source === 'tool-maxCountTool',
      );

      expect(exitEdges).toHaveLength(1);
      expect(continueEdges).toHaveLength(1);
    });

    it('should apply correct opacity based on focused tool', () => {
      const rules: SupportedToolRuleTypes[] = [
        { tool_name: 'tool1', type: 'continue_loop' },
        { tool_name: 'tool2', type: 'continue_loop' },
      ];

      const result = createEdgeData(rules, 'tool1');

      const focusedEdges = result.filter(
        (edge) => edge.source === 'agent' && edge.target === 'tool-tool1',
      );
      const unfocusedEdges = result.filter(
        (edge) => edge.source === 'agent' && edge.target === 'tool-tool2',
      );

      expect(focusedEdges).toHaveLength(1);
      expect(unfocusedEdges).toHaveLength(1);
      expect(focusedEdges[0].opacity).toBe(1);
      expect(unfocusedEdges[0].opacity).toBe(0.3);
    });
  });
});

// Create a separate utility function to test the logic
function mergedToolDataLogic(agent: any) {
  if (!agent?.tools) return [];

  const toolRulesMap = new Map<string, any[]>();

  // First, add all tool rules to the map (handle null case)
  agent.tool_rules?.forEach((rule: any) => {
    const key = rule.tool_name;
    if (key && !toolRulesMap.has(key)) {
      toolRulesMap.set(key, []);
    }
    if (key) {
      toolRulesMap.get(key)?.push(rule);
    }
  });

  // Then, ensure all tools have entries in the map (even if no rules)
  agent.tools.forEach((tool: any) => {
    const toolName = tool.name;
    if (toolName && !toolRulesMap.has(toolName)) {
      toolRulesMap.set(toolName, []);
    }
  });

  // Convert map to array of rules
  const allRules: any[] = [];
  toolRulesMap.forEach((rules, toolName) => {
    if (rules.length > 0) {
      allRules.push(...rules);
    } else {
      // Add a default rule for tools without explicit rules
      allRules.push({ tool_name: toolName });
    }
  });

  return allRules;
}

describe('mergedToolDataLogic', () => {
  it('should merge tools and tool rules correctly', () => {
    const agent = {
      tools: [{ name: 'tool1' }, { name: 'tool2' }, { name: 'tool3' }],
      tool_rules: [
        { tool_name: 'tool1', type: 'run_first' },
        { tool_name: 'tool1', type: 'max_count_per_step', max_count_limit: 5 },
        { tool_name: 'tool2', type: 'exit_loop' },
      ],
    };

    const result = mergedToolDataLogic(agent);

    expect(result).toHaveLength(4); // 3 explicit rules + 1 default for tool3
    expect(result).toEqual(
      expect.arrayContaining([
        { tool_name: 'tool1', type: 'run_first' },
        { tool_name: 'tool1', type: 'max_count_per_step', max_count_limit: 5 },
        { tool_name: 'tool2', type: 'exit_loop' },
        { tool_name: 'tool3' }, // Default rule for tool without explicit rules
      ]),
    );
  });

  it('should handle null agent', () => {
    const result = mergedToolDataLogic(null);
    expect(result).toEqual([]);
  });

  it('should handle agent with no tools', () => {
    const agent = { tools: undefined, tool_rules: [] };
    const result = mergedToolDataLogic(agent);
    expect(result).toEqual([]);
  });

  it('should handle agent with null tool_rules', () => {
    const agent = {
      tools: [{ name: 'tool1' }],
      tool_rules: null,
    };

    const result = mergedToolDataLogic(agent);
    expect(result).toEqual([{ tool_name: 'tool1' }]);
  });

  it('should handle tools with null names', () => {
    const agent = {
      tools: [{ name: 'tool1' }, { name: null }, { name: 'tool3' }],
      tool_rules: [{ tool_name: 'tool1', type: 'run_first' }],
    };

    const result = mergedToolDataLogic(agent);

    // Should only include tools with valid names
    expect(result).toEqual([
      { tool_name: 'tool1', type: 'run_first' },
      { tool_name: 'tool3' },
    ]);
  });
});
