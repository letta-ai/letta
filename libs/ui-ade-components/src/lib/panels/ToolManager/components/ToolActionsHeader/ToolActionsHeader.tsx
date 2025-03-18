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
  name: string;
}

function ToolName(props: ToolNameProps) {
  const { type, name } = props;
  return (
    <HStack align="center">
      <SpecificToolIcon toolType={type} />
      <Typography bold variant="body3">
        {name}
      </Typography>
    </HStack>
  );
}

interface ToolActionsHeaderProps {
  type: ToolType;
  name: string;
  idToAttach: string;
  attachedId?: string;
  actions?: React.ReactNode;
}

export function ToolActionsHeader(props: ToolActionsHeaderProps) {
  const { type, name, attachedId, idToAttach, actions } = props;

  const t = useTranslations('ToolActionsHeader');

  return (
    <HStack
      align="center"
      paddingX="medium"
      justify="spaceBetween"
      height="header-sm"
      minHeight="header-sm"
      color="background-grey"
      borderBottom
    >
      <div>
        <HiddenOnMobile>
          <ToolName type={type} name={name} />
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
        />
        {actions}
      </HStack>
    </HStack>
  );
}
