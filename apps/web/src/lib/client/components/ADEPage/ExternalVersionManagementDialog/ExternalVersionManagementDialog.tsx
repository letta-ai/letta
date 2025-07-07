import { Dialog } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface ExternalVersionManagementDialogProps {
  trigger: React.ReactNode;
}

export function ExternalVersionManagementDialog(
  props: ExternalVersionManagementDialogProps,
) {
  const t = useTranslations(
    'projects/(projectSlug)/ExternalVersionManagementDialog',
  );

  return <Dialog trigger={props.trigger} title={t('title')} size="large" />;
}
