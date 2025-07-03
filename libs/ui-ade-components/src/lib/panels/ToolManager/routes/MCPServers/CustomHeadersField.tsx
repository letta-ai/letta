import { useTranslations } from '@letta-cloud/translations';
import { FormField, KeyValueEditor } from '@letta-cloud/ui-component-library';

export interface CustomHeader {
  key: string;
  value: string;
}

export function CustomHeadersField() {
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <FormField
      name="customHeaders"
      render={({ field }) => (
        <KeyValueEditor
          value={field.value}
          onValueChange={field.onChange}
          label={t('AddServerDialog.customHeaders.label')}
          hideLabel
          keyPlaceholder={t('AddServerDialog.customHeaders.keyPlaceholder')}
          valuePlaceholder={t('AddServerDialog.customHeaders.valuePlaceholder')}
          addVariableLabel={t('AddServerDialog.customHeaders.addHeader')}
          removeVariableLabel={t('AddServerDialog.customHeaders.removeHeader')}
          highlightDuplicateKeys
          fullWidth
        />
      )}
    />
  );
}
