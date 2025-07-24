import { parseMCPJsonConfig } from './configParser';

describe('parseMCPConfig', () => {
  describe('Cursor style configs', () => {
    it('should parse Cursor style with command string for webflow', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          webflow: {
            command: 'npx mcp-remote https://mcp.webflow.com/sse',
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'webflow',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.webflow.com/sse',
        env: undefined,
      });
    });

    it('should parse Cursor style with serverUrl field for deepwiki', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          deepwiki: {
            serverUrl: 'https://mcp.deepwiki.com/sse',
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'deepwiki',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.deepwiki.com/sse',
        env: undefined,
      });
    });

    it('should parse Cursor style with url field for sentry', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          sentry: {
            url: 'https://mcp.sentry.dev/mcp',
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'sentry',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.sentry.dev/mcp',
        env: undefined,
      });
    });
  });

  describe('Claude Desktop style configs', () => {
    it('should parse Claude style config for mcp_square_api', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          mcp_square_api: {
            command: 'npx',
            args: ['mcp-remote', 'https://mcp.squareup.com/sse'],
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'mcp_square_api',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.squareup.com/sse',
        env: undefined,
      });
    });

    it('should parse Claude style with extra args for Neon', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          Neon: {
            command: 'npx',
            args: ['-y', 'mcp-remote@latest', 'https://mcp.neon.tech/sse'],
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'Neon',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.neon.tech/sse',
        env: undefined,
      });
    });

    it('should parse Claude style with headers and env for remote-example', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          'remote-example': {
            command: 'npx',
            args: [
              'mcp-remote',
              'https://remote.mcp.server/sse',
              '--header',
              'Authorization: Bearer ${AUTH_TOKEN}',
              'Content-Type: ${CONTENT_TYPE}',
            ],
            env: {
              AUTH_TOKEN: 'token',
              CONTENT_TYPE: 'application/json',
            },
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'remote-example',
        command: undefined,
        args: undefined,
        serverUrl: 'https://remote.mcp.server/sse',
        env: undefined,
        customHeaders: [
          {
            key: 'Authorization',
            value: 'Bearer token',
          },
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      });
    });
  });

  describe('Windsurf style configs', () => {
    it('should parse Windsurf style with extra args for sentry', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          sentry: {
            command: 'npx',
            args: ['-y', 'mcp-remote@latest', 'https://mcp.sentry.dev/mcp'],
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'sentry',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.sentry.dev/mcp',
        env: undefined,
      });
    });

    it('should parse Windsurf style for linear', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          linear: {
            command: 'npx',
            args: ['-y', 'mcp-remote', 'https://mcp.linear.app/sse'],
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'linear',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.linear.app/sse',
        env: undefined,
      });
    });

    it('should parse Windsurf style for square_api', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          square_api: {
            command: 'npx',
            args: ['mcp-remote', 'https://mcp.squareup.com/sse'],
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'square_api',
        command: undefined,
        args: undefined,
        serverUrl: 'https://mcp.squareup.com/sse',
        env: undefined,
      });
    });
  });

  describe('Local server configs', () => {
    it('should parse local server config without URL extraction', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          webflow: {
            command: 'npx',
            args: ['-y', 'webflow-mcp-server'],
            env: {
              WEBFLOW_TOKEN: 'YOUR_API_TOKEN',
            },
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'webflow',
        command: 'npx',
        args: ['-y', 'webflow-mcp-server'],
        serverUrl: undefined,
        env: {
          WEBFLOW_TOKEN: 'YOUR_API_TOKEN',
        },
      });
    });

    it('should parse Docker-based MCP Atlassian config with complex args and env', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          'mcp-atlassian': {
            command: 'docker',
            args: [
              'run',
              '-i',
              '--rm',
              '-e',
              'CONFLUENCE_URL',
              '-e',
              'CONFLUENCE_USERNAME',
              '-e',
              'CONFLUENCE_API_TOKEN',
              '-e',
              'JIRA_URL',
              '-e',
              'JIRA_USERNAME',
              '-e',
              'JIRA_API_TOKEN',
              'ghcr.io/sooperset/mcp-atlassian:latest',
            ],
            env: {
              CONFLUENCE_URL: 'https://your-company.atlassian.net/wiki',
              CONFLUENCE_USERNAME: 'your.email@company.com',
              CONFLUENCE_API_TOKEN: 'your_confluence_api_token',
              JIRA_URL: 'https://your-company.atlassian.net',
              JIRA_USERNAME: 'your.email@company.com',
              JIRA_API_TOKEN: 'your_jira_api_token',
            },
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'mcp-atlassian',
        command: 'docker',
        args: [
          'run',
          '-i',
          '--rm',
          '-e',
          'CONFLUENCE_URL',
          '-e',
          'CONFLUENCE_USERNAME',
          '-e',
          'CONFLUENCE_API_TOKEN',
          '-e',
          'JIRA_URL',
          '-e',
          'JIRA_USERNAME',
          '-e',
          'JIRA_API_TOKEN',
          'ghcr.io/sooperset/mcp-atlassian:latest',
        ],
        serverUrl: undefined,
        env: {
          CONFLUENCE_URL: 'https://your-company.atlassian.net/wiki',
          CONFLUENCE_USERNAME: 'your.email@company.com',
          CONFLUENCE_API_TOKEN: 'your_confluence_api_token',
          JIRA_URL: 'https://your-company.atlassian.net',
          JIRA_USERNAME: 'your.email@company.com',
          JIRA_API_TOKEN: 'your_jira_api_token',
        },
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should return null for invalid JSON', () => {
      const result = parseMCPJsonConfig('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for JSON without mcpServers', () => {
      const configJson = JSON.stringify({
        someOtherKey: 'value',
      });

      const result = parseMCPJsonConfig(configJson);
      expect(result).toBeNull();
    });

    it('should return null for empty mcpServers object', () => {
      const configJson = JSON.stringify({
        mcpServers: {},
      });

      const result = parseMCPJsonConfig(configJson);
      expect(result).toBeNull();
    });

    it('should use the first server if multiple servers are defined', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          first_server: {
            command: 'first',
          },
          second_server: {
            command: 'second',
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'first_server',
        command: 'first',
        args: undefined,
        serverUrl: undefined,
        env: undefined,
      });
    });
  });

  describe('Legacy test cases', () => {
    it('should parse valid MCP config with server_url', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          sse_server: {
            server_url: 'https://api.example.com/sse',
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'sse_server',
        command: undefined,
        args: undefined,
        serverUrl: 'https://api.example.com/sse',
        env: undefined,
      });
    });

    it('should parse config with environment variables', () => {
      const configJson = JSON.stringify({
        mcpServers: {
          test_server: {
            command: 'node',
            args: ['server.js'],
            env: {
              API_KEY: 'test-key',
              PORT: '3000',
            },
          },
        },
      });

      const result = parseMCPJsonConfig(configJson);

      expect(result).toEqual({
        serverName: 'test_server',
        command: 'node',
        args: ['server.js'],
        serverUrl: undefined,
        env: {
          API_KEY: 'test-key',
          PORT: '3000',
        },
      });
    });
  });
});
