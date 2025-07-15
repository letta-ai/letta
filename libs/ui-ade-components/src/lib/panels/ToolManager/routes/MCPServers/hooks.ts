import { useMemo, useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import { AuthModes } from './AuthenticationSection';

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

// Custom header schema
const customHeaderSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// Environment variable schema
const environmentVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
});

function validateAuthenticationInputs(data: {
  authMode: AuthModes;
  authToken?: string;
  customHeaders?: Array<{ key: string; value: string }>;
}) {
  if (data.authMode === AuthModes.API_KEY && !data.authToken) {
    return false;
  }
  if (
    data.authMode === AuthModes.CUSTOM_HEADERS &&
    (!data.customHeaders ||
      data.customHeaders.length === 0 ||
      !data.customHeaders.some((h) => h.key && h.value))
  ) {
    return false;
  }
  return true;
}

// Hook for SSE Server Schema
export function useSSEServerSchema() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useMemo(
    () =>
      z
        .object({
          name: createServerNameSchema(t('AddServerDialog.name.error')),
          serverUrl: createServerUrlSchema(
            t('AddServerDialog.serverUrl.required'),
            t('AddServerDialog.serverUrl.invalid'),
          ),
          authMode: z
            .enum([AuthModes.NONE, AuthModes.API_KEY, AuthModes.CUSTOM_HEADERS])
            .default(AuthModes.NONE),
          authToken: z.string().optional(),
          customHeaders: z
            .array(customHeaderSchema)
            .optional()
            .default([{ key: '', value: '' }]),
        })
        .refine(validateAuthenticationInputs, {
          message: t('AddServerDialog.authMode.validationError'),
        }),
    [t],
  );
}

// Hook for Streamable HTTP Server Schema
export function useStreamableHttpServerSchema() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return useMemo(
    () =>
      z
        .object({
          name: createServerNameSchema(t('AddServerDialog.name.error')),
          serverUrl: createServerUrlSchema(
            t('AddServerDialog.serverUrl.required'),
            t('AddServerDialog.serverUrl.invalid'),
          ),
          authMode: z
            .enum([AuthModes.NONE, AuthModes.API_KEY, AuthModes.CUSTOM_HEADERS])
            .default(AuthModes.NONE),
          authToken: z.string().optional(),
          customHeaders: z
            .array(customHeaderSchema)
            .optional()
            .default([{ key: '', value: '' }]),
        })
        .refine(validateAuthenticationInputs, {
          message: t('AddServerDialog.authMode.validationError'),
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
        environment: z
          .array(environmentVariableSchema)
          .optional()
          .default([{ key: '', value: '' }]),
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
