export const SERVER_CONFIGS = {
  github: {
    type: 'streamable_http',
    auth: 'custom_headers',
    urlField: 'serverUrl',
    defaultUrl: 'https://api.githubcopilot.com/mcp/',
    customNaming: false,
  },
  zapier: {
    type: 'streamable_http',
    auth: 'api_key',
    urlField: 'serverUrl',
    customNaming: false,
  },
  stripe: {
    type: 'streamable_http',
    auth: 'api_key',
    urlField: 'serverUrl',
    customNaming: false,
  },
  apify: {
    type: 'streamable_http',
    auth: 'api_key',
    urlField: 'serverUrl',
    customNaming: false,
  },
  exa: {
    type: 'streamable_http',
    auth: 'api_key',
    urlField: 'serverUrl',
    customNaming: false,
  },
  deepwiki: {
    type: 'streamable_http',
    auth: 'none',
    staticUrl: 'https://mcp.deepwiki.com/mcp',
    customNaming: false,
  },
  pipedream: {
    type: 'sse',
    auth: 'server_url',
    urlField: 'input',
    customNaming: true,
  },
  huggingface: {
    type: 'streamable_http',
    auth: 'none',
    staticUrl: 'https://huggingface.co/mcp',
    customNaming: false,
  },
  composio: {
    type: 'streamable_http',
    auth: 'server_url',
    urlField: 'input',
    customNaming: false,
  },
} as const;
