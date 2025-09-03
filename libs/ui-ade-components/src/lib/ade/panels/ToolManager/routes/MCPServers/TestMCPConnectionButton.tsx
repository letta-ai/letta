import { useCallback, useState, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  VStack,
  StatusIndicator,
  Typography,
} from '@letta-cloud/ui-component-library';
import type {
  SSEServerConfig,
  StdioServerConfig,
  StreamableHTTPServerConfig,
} from '@letta-cloud/sdk-core';
import { useToolsServiceTestMcpServer } from '@letta-cloud/sdk-core';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { MCPServerTypes, OauthStreamEvent, type MCPTool } from './types';
import {
  parseAuthenticationData,
  parseArgsString,
  parseEnvironmentArray,
  parseMCPTool,
} from './utils';
import { MCPToolsList } from './MCPToolsList';
import { AuthModes } from './FormFields';
import { useLettaAgentsAPI } from '@letta-cloud/utils-client';

interface TestMCPConnectionButtonProps {
  serverType: string;
}

export function TestMCPConnectionButton({
  serverType,
}: TestMCPConnectionButtonProps) {
  const { watch, getValues } = useFormContext();

  // Try multiple field names since different forms use different names
  const serverUrl = watch('serverUrl') || watch('input');

  const [testingStatus, setTestingStatus] = useState<
    'failed' | 'oauth_pending' | 'oauth_required' | 'pending' | 'success' | null
  >(null);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const abortController = useRef<AbortController | undefined>(undefined);
  const t = useTranslations('ToolsEditor/MCPServers');
  const { baseUrl, password } = useLettaAgentsAPI();

  // Feature flag for MCP OAuth
  const { data: isMcpOauthEnabled = false } = useFeatureFlag('MCP_OAUTH');

  // Legacy mutation for when feature flag is disabled
  const testMcpServerMutation = useToolsServiceTestMcpServer({
    onSuccess: (response: any) => {
      if (response && 'tools' in response && Array.isArray(response.tools)) {
        const mcpTools = response.tools.map((tool: any, index: number) => {
          return parseMCPTool(tool, index);
        });
        setAvailableTools(mcpTools);
        setTestingStatus('success');
      } else {
        // OAuth might be required, but legacy endpoint doesn't support it
        setTestingStatus('failed');
      }
    },
    onError: () => {
      setTestingStatus('failed');
    },
  });

  const handleOAuthFlow = useCallback(() => {
    if (!oauthUrl) return;

    // Open OAuth URL in new tab
    window.open(oauthUrl, '_blank');

    // Set status to waiting - the SSE stream will handle the rest
    setTestingStatus('oauth_pending');
  }, [oauthUrl]);

  const testConnectionWithStreaming = useCallback(async () => {
    setTestingStatus('pending');
    setAvailableTools([]);
    setOauthUrl(null);

    if (
      serverType === MCPServerTypes.Sse ||
      serverType === MCPServerTypes.StreamableHttp
    ) {
      if (!serverUrl) {
        setTestingStatus('failed');
        return;
      }
    }

    // Abort any existing request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();

    const formValues = getValues();
    const authMode = formValues.authMode || AuthModes.NONE;
    const authToken = formValues.authToken;
    const customHeaders = formValues.customHeaders;

    const {
      authHeaders,
      authHeader,
      authToken: authTokenValue,
    } = parseAuthenticationData({
      authMode,
      authToken,
      customHeaders,
      options: { formatToken: true, includeAuthHeader: true },
    });

    // TODO: @jnjpng - should make server name optional for just testing as part of server name / id refactor
    const testServerName = 'test_connection_server';
    const requestBody:
      | SSEServerConfig
      | StdioServerConfig
      | StreamableHTTPServerConfig
      | undefined =
      serverType === MCPServerTypes.Sse
        ? {
            server_name: testServerName,
            type: serverType,
            server_url: serverUrl,
            auth_header: authHeader,
            auth_token: authTokenValue,
            custom_headers: authHeaders,
          }
        : serverType === MCPServerTypes.StreamableHttp
          ? {
              server_name: testServerName,
              type: serverType,
              server_url: serverUrl,
              auth_header: authHeader,
              auth_token: authTokenValue,
              custom_headers: authHeaders,
            }
          : serverType === MCPServerTypes.Stdio
            ? {
                server_name: testServerName,
                type: serverType,
                command: formValues.command,
                args: parseArgsString(formValues.args),
                env: parseEnvironmentArray(formValues.environment),
              }
            : undefined;

    if (!requestBody) {
      setTestingStatus('failed');
      return;
    }

    // Make request to SSE streaming endpoint for handling OAuth flow
    try {
      const response = await fetch(`${baseUrl}/v1/tools/mcp/servers/connect`, {
        method: 'POST',
        headers: {
          'X-SOURCE-CLIENT': window.location.pathname,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(password
            ? {
                Authorization: `Bearer ${password}`,
                'X-BARE-PASSWORD': `password ${password}`,
              }
            : {}),
        },
        body: JSON.stringify(requestBody),
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          'Request failed:',
          response.status,
          response.statusText,
          errorBody,
        );
        setTestingStatus('failed');
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        console.error('Failed to get reader');
        setTestingStatus('failed');
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setTestingStatus('failed');
          break;
        }

        if (abortController.current?.signal.aborted) {
          await reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;

          // Parse SSE format: "data: {json}"
          let data = line;
          if (line.startsWith('data: ')) {
            data = line.substring(6);
          }

          if (data.trim() === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            switch (parsed.event) {
              case OauthStreamEvent.CONNECTION_ATTEMPT:
                setTestingStatus('pending');
                break;

              case OauthStreamEvent.OAUTH_REQUIRED:
                setTestingStatus('pending');
                break;

              case OauthStreamEvent.AUTHORIZATION_URL:
                setOauthUrl(parsed.url);
                setTestingStatus('oauth_required');
                break;

              case OauthStreamEvent.WAITING_FOR_AUTH:
                setTestingStatus('oauth_required');
                break;

              case OauthStreamEvent.SUCCESS: {
                const mcpTools = (parsed.tools || []).map(
                  (tool: any, index: number) => {
                    return parseMCPTool(tool, index);
                  },
                );

                setAvailableTools(mcpTools);
                setTestingStatus('success');
                return;
              }
              case OauthStreamEvent.ERROR:
                setTestingStatus('failed');
                return;
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError);
            // Continue processing other lines
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, don't treat as error
        return;
      }
      console.error('Error in streaming request:', error);
      setTestingStatus('failed');
    }
  }, [serverType, serverUrl, getValues, baseUrl, password]);

  const testConnectionWithLegacy = useCallback(async () => {
    setTestingStatus('pending');
    setAvailableTools([]);
    setOauthUrl(null);

    if (
      serverType === MCPServerTypes.Sse ||
      serverType === MCPServerTypes.StreamableHttp
    ) {
      if (!serverUrl) {
        setTestingStatus('failed');
        return;
      }
    }

    const formValues = getValues();
    const authMode = formValues.authMode || AuthModes.NONE;
    const authToken = formValues.authToken;
    const customHeaders = formValues.customHeaders;

    const {
      authHeaders,
      authHeader,
      authToken: authTokenValue,
    } = parseAuthenticationData({
      authMode,
      authToken,
      customHeaders,
      options: { formatToken: true, includeAuthHeader: true },
    });

    const testServerName = 'test_connection_server';

    const requestBody:
      | SSEServerConfig
      | StdioServerConfig
      | StreamableHTTPServerConfig
      | undefined =
      serverType === MCPServerTypes.Sse
        ? {
            server_name: testServerName,
            type: MCPServerTypes.Sse,
            server_url: serverUrl,
            auth_header: authHeader,
            auth_token: authTokenValue,
            custom_headers: authHeaders,
          }
        : serverType === MCPServerTypes.StreamableHttp
          ? {
              server_name: testServerName,
              type: MCPServerTypes.StreamableHttp,
              server_url: serverUrl,
              auth_header: authHeader,
              auth_token: authTokenValue,
              custom_headers: authHeaders,
            }
          : serverType === MCPServerTypes.Stdio
            ? {
                server_name: testServerName,
                type: MCPServerTypes.Stdio,
                command: formValues.command,
                args: parseArgsString(formValues.args),
                env: parseEnvironmentArray(formValues.environment),
              }
            : undefined;

    if (!requestBody) {
      setTestingStatus('failed');
      return;
    }

    await testMcpServerMutation.mutateAsync({ requestBody });
  }, [serverType, serverUrl, getValues, testMcpServerMutation]);

  const testConnection = useCallback(async () => {
    if (isMcpOauthEnabled) {
      await testConnectionWithStreaming();
    } else {
      await testConnectionWithLegacy();
    }
  }, [
    isMcpOauthEnabled,
    testConnectionWithStreaming,
    testConnectionWithLegacy,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return (
    <VStack gap="large" padding="small" border fullWidth>
      <HStack align="center" justify="spaceBetween" fullWidth>
        <Button
          type="button"
          color="secondary"
          disabled={
            testingStatus === 'pending' || testingStatus === 'oauth_required'
          }
          label={t('TestMCPConnectionButton.label')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void testConnection();
          }}
        />
        <HStack paddingRight="small">
          {testingStatus === 'success' && (
            <HStack align="center">
              <Typography variant="body2" bold>
                {t('TestMCPConnectionButton.success.label')}
              </Typography>
              <StatusIndicator status="active" animate />
            </HStack>
          )}
          {testingStatus === 'failed' && (
            <HStack align="center">
              <Typography variant="body2" bold>
                {t('TestMCPConnectionButton.failed.label')}
              </Typography>
              <StatusIndicator status="inactive" />
            </HStack>
          )}
          {testingStatus === 'pending' && (
            <HStack align="center">
              <Typography variant="body2" bold>
                {t('TestMCPConnectionButton.pending')}
              </Typography>
              <StatusIndicator status="processing" />
            </HStack>
          )}
          {testingStatus === 'oauth_required' && (
            <HStack align="center">
              <Button
                type="button"
                color="brand"
                label="Authorize"
                onClick={handleOAuthFlow}
              />
            </HStack>
          )}
          {testingStatus === 'oauth_pending' && (
            <HStack align="center">
              <Typography variant="body2" bold>
                {t('TestMCPConnectionButton.oauthPending')}
              </Typography>
              <StatusIndicator status="processing" />
            </HStack>
          )}
          {testingStatus === null && (
            <HStack align="center">
              <StatusIndicator status="default" />
            </HStack>
          )}
        </HStack>
      </HStack>
      {testingStatus === 'failed' && (
        <HStack padding="xsmall">
          <Typography variant="body2" color="muted">
            {t('TestMCPConnectionButton.failed.tooltip')}
          </Typography>
        </HStack>
      )}
      {testingStatus === 'oauth_required' && (
        <HStack padding="xsmall">
          <Typography variant="body2" color="muted">
            {t('TestMCPConnectionButton.failed.authorization')}
          </Typography>
        </HStack>
      )}
      <MCPToolsList tools={availableTools} />
    </VStack>
  );
}
