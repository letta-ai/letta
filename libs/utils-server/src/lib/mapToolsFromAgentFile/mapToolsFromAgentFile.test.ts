/* eslint-disable @typescript-eslint/no-explicit-any */
import { ToolsService } from '@letta-cloud/sdk-core';
import type {
  AgentFileSchema,
  letta__schemas__agent_file__AgentSchema,
  Tool
} from '@letta-cloud/sdk-core';
import {
  extractToolNamesFromAgentFile,
  mapToolsFromAgentFile,
  mapAgentToolIds
} from './mapToolsFromAgentFile';

// Mock the ToolsService
jest.mock('@letta-cloud/sdk-core', () => ({
  ToolsService: {
    listTools: jest.fn(),
    createTool: jest.fn(),
  },
}));

describe('mapToolsFromAgentFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractToolNamesFromAgentFile', () => {
    it('should extract tool names from agent file tools array', () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [
          {
            id: 'tool1',
            name: 'calculate_sum',
            source_code: 'def calculate_sum(): pass',
            json_schema: { type: 'function', function: { name: 'calculate_sum', description: 'Calculate sum' } }
          },
          {
            id: 'tool2',
            name: 'send_email',
            source_code: 'def send_email(): pass',
            json_schema: { type: 'function', function: { name: 'send_email', description: 'Send email' } }
          },
          { id: 'tool3', name: null, source_code: 'def unnamed(): pass' }, // Should be ignored - no name
          { id: 'tool4', name: 'builtin_tool', source_code: null }, // Should be ignored - no source_code (builtin)
        ] as any[],
        mcp_servers: [],
      };

      const toolNames = extractToolNamesFromAgentFile(mockAgentFile);
      expect(toolNames).toEqual(['calculate_sum', 'send_email', 'builtin_tool']);
    });

    it('should return empty array when no tools', () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
      };

      const toolNames = extractToolNamesFromAgentFile(mockAgentFile);
      expect(toolNames).toEqual([]);
    });

    it('should handle missing tools array', () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: undefined as any,
        mcp_servers: [],
      };

      const toolNames = extractToolNamesFromAgentFile(mockAgentFile);
      expect(toolNames).toEqual([]);
    });
  });

  describe('mapAgentToolIds', () => {
    it('should map tool IDs using tool mapping', () => {
      const mockAgent: letta__schemas__agent_file__AgentSchema = {
        id: 'agent1',
        tool_ids: ['tool1', 'tool2', 'tool3'],
      };

      const toolMapping = {
        tool1: 'server-tool-1',
        tool2: 'server-tool-2',
        // tool3 is missing from mapping
      };

      const mappedIds = mapAgentToolIds(mockAgent, toolMapping);
      expect(mappedIds).toEqual(['server-tool-1', 'server-tool-2']);
    });

    it('should return empty array when agent has no tool_ids', () => {
      const mockAgent: letta__schemas__agent_file__AgentSchema = {
        id: 'agent1',
        tool_ids: undefined,
      };

      const toolMapping = { tool1: 'server-tool-1' };
      const mappedIds = mapAgentToolIds(mockAgent, toolMapping);
      expect(mappedIds).toEqual([]);
    });

    it('should return empty array when agent is undefined', () => {
      const toolMapping = { tool1: 'server-tool-1' };
      const mappedIds = mapAgentToolIds(undefined, toolMapping);
      expect(mappedIds).toEqual([]);
    });
  });

  describe('mapToolsFromAgentFile', () => {
    it('should return mapping for existing tools and create missing ones', async () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [
          {
            id: 'tool1',
            name: 'calculate_sum',
            source_code: 'def calculate_sum(): pass',
            description: 'Calculates sum',
            source_type: 'python',
            json_schema: { type: 'function', function: { name: 'calculate_sum', description: 'Calculates sum' } }
          },
          {
            id: 'tool2',
            name: 'send_email',
            source_code: 'def send_email(): pass',
            description: 'Sends email',
            source_type: 'python',
            json_schema: { type: 'function', function: { name: 'send_email', description: 'Sends email' } }
          },
        ] as any[],
        mcp_servers: [],
      };

      // Mock existing tool found
      const existingTool: Tool = { id: 'server-tool-1', name: 'calculate_sum' } as Tool;
      (ToolsService.listTools as any).mockResolvedValue([existingTool]);

      // Mock tool creation
      const createdTool: Tool = { id: 'server-tool-2', name: 'send_email' } as Tool;
      (ToolsService.createTool as any).mockResolvedValue(createdTool);

      const result = await mapToolsFromAgentFile({
        base: mockAgentFile,
        lettaAgentsId: 'user123',
      });

      expect(result).toEqual({
        tool1: 'server-tool-1',
        tool2: 'server-tool-2',
      });

      expect(ToolsService.listTools).toHaveBeenCalledWith(
        { names: ['calculate_sum', 'send_email'] },
        { user_id: 'user123' }
      );

      expect(ToolsService.createTool).toHaveBeenCalledWith(
        {
          requestBody: {
            source_code: 'def send_email(): pass',
            source_type: 'python',
            json_schema: { type: 'function', function: { name: 'send_email', description: 'Sends email' } },
            description: 'Sends email',
            tags: undefined,
          },
        },
        { user_id: 'user123' }
      );
    });

    it('should return empty mapping when no tools exist', async () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
      };

      const result = await mapToolsFromAgentFile({
        base: mockAgentFile,
        lettaAgentsId: 'user123',
      });

      expect(result).toEqual({});
      expect(ToolsService.listTools).not.toHaveBeenCalled();
      expect(ToolsService.createTool).not.toHaveBeenCalled();
    });

    it('should handle tools without source_code gracefully (builtin tools ignored)', async () => {
      const mockAgentFile: AgentFileSchema = {
        agents: [],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [
          {
            id: 'tool1',
            name: 'calculate_sum',
            source_code: null, // No source code (builtin tool)
            description: 'Calculates sum'
          },
          {
            id: 'tool2',
            name: 'send_email',
            source_code: 'def send_email(): pass',
            description: 'Sends email',
            json_schema: { type: 'function', function: { name: 'send_email', description: 'Sends email' } }
          },
        ] as any[],
        mcp_servers: [],
      };

      (ToolsService.listTools as any).mockResolvedValue([]);
      const createdTool: Tool = { id: 'server-tool-2', name: 'send_email' } as Tool;
      (ToolsService.createTool as any).mockResolvedValue(createdTool);

      const result = await mapToolsFromAgentFile({
        base: mockAgentFile,
        lettaAgentsId: 'user123',
      });

      expect(result).toEqual({
        tool2: 'server-tool-2',
      });

      // Only one tool should be created (the one with source_code)
      expect(ToolsService.createTool).toHaveBeenCalledTimes(1);
    });

  });
});
