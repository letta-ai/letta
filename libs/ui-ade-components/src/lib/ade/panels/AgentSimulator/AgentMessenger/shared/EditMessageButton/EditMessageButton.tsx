import { Button, EditIcon } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface EditMessageButtonProps {
  onEdit: () => void;
  isEditing?: boolean;
}

export function EditMessageButton(props: EditMessageButtonProps) {
  const { onEdit, isEditing } = props;
  const t = useTranslations('AgentMessenger/shared/EditMessageButton');

  return (
    <Button
      size="2xsmall"
      hideLabel
      color="tertiary"
      label={t('edit')}
      onClick={onEdit}
      active={isEditing}
      preIcon={<EditIcon color="muted" size="xsmall" />}
    />
  )
}
