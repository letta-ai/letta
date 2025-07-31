import { useId } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Accordion,
  Typography,
  RawCodeEditor,
  VStack,
} from '@letta-cloud/ui-component-library';

interface ConfigSectionProps {
  configValue: string;
  onChange: (value: string) => void;
  isOpen?: boolean;
}

export function ConfigSection({
  configValue,
  onChange,
  isOpen = false,
}: ConfigSectionProps) {
  const t = useTranslations('ToolsEditor/MCPServers');
  const accordionId = useId();

  return (
    <Accordion
      id={accordionId}
      trigger={
        <Typography variant="body2" uppercase color="muted">
          {t('AddServerDialog.advancedSettings.label')}
        </Typography>
      }
      defaultOpen={isOpen}
    >
      <VStack gap="form" paddingTop>
        <RawCodeEditor
          fontSize="small"
          fullWidth
          flex
          variant="default"
          label={t('AddServerDialog.advancedSettings.config')}
          showLineNumbers
          fullHeight
          language="javascript"
          onSetCode={onChange}
          code={configValue}
          placeholder={t('AddServerDialog.advancedSettings.placeholder')}
          description={t('AddServerDialog.advancedSettings.description')}
          minHeight="305px"
        />
      </VStack>
    </Accordion>
  );
}
