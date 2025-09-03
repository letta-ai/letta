import type { ToolType } from '@letta-cloud/sdk-core';
import {
  HiddenOnMobile,
  HStack,
  Typography,
  VisibleOnMobile,
} from '@letta-cloud/ui-component-library';
import { SpecificToolIcon } from '../SpecificToolIcon/SpecificToolIcon';
import { useTranslations } from '@letta-cloud/translations';
import { AttachDetachButton } from '../AttachDetachButton/AttachDetachButton';

interface ToolNameProps {
  type: ToolType;
  sourceType?: string;
  name: string;
}

function ToolName(props: ToolNameProps) {
  const { type, sourceType, name } = props;
  return (
    <HStack align="center">
      <SpecificToolIcon toolType={type} sourceType={sourceType} />
      <Typography bold>{name}</Typography>
    </HStack>
  );
}

interface ToolActionsHeaderProps {
  type: ToolType;
  sourceType?: string;
  name: string;
  idToAttach: string;
  attachedId?: string;
  actions?: React.ReactNode;
}

export function ToolActionsHeader(props: ToolActionsHeaderProps) {
  const { type, sourceType, name, attachedId, idToAttach, actions } = props;

  const t = useTranslations('ToolActionsHeader');

  return (
    <HStack align="center" padding justify="spaceBetween" minHeight="header-sm">
      <div>
        <HiddenOnMobile>
          <ToolName type={type} sourceType={sourceType} name={name} />
        </HiddenOnMobile>
        <VisibleOnMobile>
          <HStack paddingLeft="small">
            <Typography>{t('title')}</Typography>
          </HStack>
        </VisibleOnMobile>
      </div>
      <HStack gap="medium">
        <AttachDetachButton
          toolType={type}
          idToAttach={idToAttach}
          attachedId={attachedId}
          toolName={name}
        />
        {actions}
      </HStack>
    </HStack>
  );
}
