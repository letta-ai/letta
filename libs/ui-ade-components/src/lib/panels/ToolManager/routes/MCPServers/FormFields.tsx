import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  CodeEditor,
  FormActions,
  FormField,
  Input,
  KeyValueEditor,
} from '@letta-cloud/ui-component-library';

export { AuthenticationSection, AuthModes } from './AuthenticationSection';
export { CustomHeadersField } from './CustomHeadersField';
export type { CustomHeader } from './CustomHeadersField';
export type { AuthMode } from './AuthenticationSection';

interface ServerNameFieldProps {
  disabled?: boolean;
}

export function ServerNameField({ disabled = false }: ServerNameFieldProps) {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="name"
      render={({ field }) => (
        <Input
          fullWidth
          {...field}
          disabled={disabled}
          placeholder={t('AddServerDialog.name.placeholder')}
          label={t('AddServerDialog.name.label')}
        />
      )}
    />
  );
}

export function ServerUrlField() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="serverUrl"
      render={({ field }) => (
        <Input
          fullWidth
          {...field}
          label={t('AddServerDialog.serverUrl.label')}
          placeholder={t('AddServerDialog.serverUrl.placeholder')}
        />
      )}
    />
  );
}

interface AuthTokenFieldProps {
  isUpdate?: boolean;
}

export function AuthTokenField({ isUpdate = false }: AuthTokenFieldProps) {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="authToken"
      render={({ field }) => (
        <Input
          fullWidth
          {...field}
          type="password"
          label={t('AddServerDialog.authToken.label')}
          hideLabel
          placeholder={t(
            isUpdate
              ? 'UpdateServerDialog.authToken.placeholder'
              : 'AddServerDialog.authToken.placeholder',
          )}
        />
      )}
    />
  );
}

interface MCPFormActionsProps {
  onCancel: () => void;
  isPending: boolean;
  isUpdate?: boolean;
  errorMessage?: React.ReactNode;
}

export function MCPFormActions({
  onCancel,
  isPending,
  isUpdate = false,
  errorMessage,
}: MCPFormActionsProps) {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormActions errorMessage={errorMessage}>
      <Button
        type="button"
        label={t('AddServerDialog.cancel')}
        onClick={onCancel}
        color="tertiary"
      />
      <Button
        type="submit"
        label={t(
          isUpdate ? 'UpdateServerDialog.submit' : 'AddServerDialog.submit',
        )}
        busy={isPending}
      />
    </FormActions>
  );
}

export function CommandField() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="command"
      render={({ field }) => (
        <CodeEditor
          label={t('AddServerDialog.command.label')}
          fullWidth
          fontSize="small"
          onSetCode={field.onChange}
          showLineNumbers={false}
          language="bash"
          code={field.value}
          placeholder={t('AddServerDialog.command.placeholder')}
        />
      )}
    />
  );
}

export function ArgsField() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="args"
      render={({ field }) => (
        <CodeEditor
          label={t('AddServerDialog.args.label')}
          fullWidth
          fontSize="small"
          onSetCode={field.onChange}
          showLineNumbers={false}
          language="bash"
          code={field.value}
          placeholder={t('AddServerDialog.args.placeholder')}
        />
      )}
    />
  );
}

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export function EnvironmentField() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="environment"
      render={({ field }) => (
        <KeyValueEditor
          value={field.value}
          onValueChange={field.onChange}
          label={t('AddServerDialog.environment.label')}
          keyPlaceholder={t('AddServerDialog.environment.keyPlaceholder')}
          valuePlaceholder={t('AddServerDialog.environment.valuePlaceholder')}
          addVariableLabel={t('AddServerDialog.environment.addVariable')}
          removeVariableLabel={t('AddServerDialog.environment.removeVariable')}
          highlightDuplicateKeys
          fullWidth
        />
      )}
    />
  );
}
