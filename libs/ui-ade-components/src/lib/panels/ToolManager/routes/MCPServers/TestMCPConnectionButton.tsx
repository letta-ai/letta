import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  VStack,
  StatusIndicator,
  Typography,
} from '@letta-cloud/ui-component-library';
import {
  useToolsServiceTestMcpServer,
  type MCPServerType,
} from '@letta-cloud/sdk-core';
import { MCPServerTypes, type MCPTool } from './types';
import { parseAuthenticationData } from './utils';
import { MCPToolsList } from './MCPToolsList';
import { AuthModes } from './FormFields';

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
    'failed' | 'pending' | 'success' | null
  >(null);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const t = useTranslations('ToolsEditor/MCPServers');

  const { mutate: testServer, isPending } = useToolsServiceTestMcpServer({
    onSuccess: (tools) => {
      setAvailableTools(tools as MCPTool[]);
      setTestingStatus('success');
    },
    onError: (_error) => {
      setAvailableTools([]);
      setTestingStatus('failed');
    },
  });

  const isDisabled = isPending || serverType === MCPServerTypes.Stdio;

  const testConnection = useCallback(() => {
    setTestingStatus('pending');
    setAvailableTools([]);

    if (serverType === MCPServerTypes.Stdio) {
      return;
    }

    if (!serverUrl) {
      setTestingStatus('failed');
      return;
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

    // Single request body for both SSE and StreamableHTTP
    const requestBody = {
      server_name: 'test_server',
      type: serverType as MCPServerType,
      server_url: serverUrl,
      auth_header: authHeader,
      auth_token: authTokenValue,
      custom_headers: authHeaders,
    };

    testServer({ requestBody });
  }, [serverType, serverUrl, getValues, testServer]);

  return (
    <VStack gap="large" padding="small" border fullWidth>
      <HStack align="center" justify="spaceBetween" fullWidth>
        <Button
          type="button"
          color="secondary"
          disabled={isDisabled}
          label={t('TestMCPConnectionButton.label')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            testConnection();
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
              {isPending && (
                <Typography variant="body2" bold>
                  {t('TestMCPConnectionButton.pending')}
                </Typography>
              )}
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
      <MCPToolsList tools={availableTools} />
    </VStack>
  );
}
