import { useMemo, useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';

// Core schema creation functions (without translations)
function createServerNameSchema(errorMessage: string) {
  return z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: errorMessage,
  });
}

function createServerUrlSchema(
  requiredMessage: string,
  invalidMessage: string,
) {
  return z
    .string()
    .min(1, requiredMessage)
    .url(invalidMessage)
    .regex(/^https?:\/\//, {
      message: invalidMessage,
    });
}

// Hook for SSE Server Schema
export function useSSEServerSchema() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useMemo(
    () =>
      z.object({
        name: createServerNameSchema(t('AddServerDialog.name.error')),
        serverUrl: createServerUrlSchema(
          t('AddServerDialog.serverUrl.required'),
          t('AddServerDialog.serverUrl.invalid'),
        ),
        authToken: z.string().optional(),
      }),
    [t],
  );
}

// Hook for Streamable HTTP Server Schema
export function useStreamableHttpServerSchema() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useMemo(
    () =>
      z.object({
        name: createServerNameSchema(t('AddServerDialog.name.error')),
        serverUrl: createServerUrlSchema(
          t('AddServerDialog.serverUrl.required'),
          t('AddServerDialog.serverUrl.invalid'),
        ),
        authToken: z.string().optional(),
      }),
    [t],
  );
}

// Hook for Stdio Server Schema
export function useStdioServerSchema() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useMemo(
    () =>
      z.object({
        name: createServerNameSchema(t('AddServerDialog.name.error')),
        command: z.string().min(1),
        args: z.string().min(1),
      }),
    [t],
  );
}

// Hook for error message handling
export function useMCPErrorMessage() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useCallback(
    (error: any, isAdd = true): string => {
      if (isAdd && error?.status === 409) {
        return t('AddServerDialog.duplicateName.error');
      }
      return t(isAdd ? 'AddServerDialog.error' : 'UpdateServerDialog.error');
    },
    [t],
  );
}

// Convenience hook that returns all schemas
export function useMCPServerSchemas() {
  const sseSchema = useSSEServerSchema();
  const streamableHttpSchema = useStreamableHttpServerSchema();
  const stdioSchema = useStdioServerSchema();

  return {
    sseSchema,
    streamableHttpSchema,
    stdioSchema,
  };
}
