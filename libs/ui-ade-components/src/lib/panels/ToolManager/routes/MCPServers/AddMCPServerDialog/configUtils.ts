import { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { parseMCPJsonConfig } from '../configParser';
import { MCPServerTypes } from '../types';
import { AuthModes } from '../AuthenticationSection';

interface CreateHandleConfigChangeParams {
  setConfigValue: (value: string) => void;
  form: UseFormReturn<any>;
  serverType: string;
}

export function createHandleConfigChange({
  setConfigValue,
  form,
  serverType,
}: CreateHandleConfigChangeParams) {
  return (value: string) => {
    setConfigValue(value);
    const parsed = parseMCPJsonConfig(value);
    if (parsed) {
      if (parsed.serverName) {
        form.setValue('name', parsed.serverName);
      }

      // Update fields based on server type
      switch (serverType) {
        case MCPServerTypes.Stdio:
          if (parsed.command) {
            form.setValue('command', parsed.command);
          }
          if (parsed.args) {
            form.setValue('args', parsed.args.join(', '));
          }
          if (parsed.env) {
            const envArray = Object.entries(parsed.env).map(([key, value]) => ({
              key,
              value,
            }));
            form.setValue('environment', envArray);
          }
          break;

        case MCPServerTypes.Sse:
        case MCPServerTypes.StreamableHttp:
          if (parsed.serverUrl) {
            form.setValue('serverUrl', parsed.serverUrl);
          }
          if (parsed.customHeaders && parsed.customHeaders.length > 0) {
            form.setValue('authMode', AuthModes.CUSTOM_HEADERS);
            form.setValue('customHeaders', parsed.customHeaders);
          }
          break;
      }
    }
  };
}

interface UseConfigHandlerParams {
  form: UseFormReturn<any>;
  serverType: string;
  setConfigValue: (value: string) => void;
}

export function useConfigHandler({
  form,
  serverType,
  setConfigValue,
}: UseConfigHandlerParams) {
  return useCallback(
    (value: string) => {
      createHandleConfigChange({ setConfigValue, form, serverType })(value);
    },
    [form, serverType, setConfigValue],
  );
}
