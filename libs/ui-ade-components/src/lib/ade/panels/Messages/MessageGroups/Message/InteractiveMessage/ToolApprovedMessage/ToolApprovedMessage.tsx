import type { ApprovalResponseMessage } from '@letta-cloud/sdk-core';
import {
  CancelIcon,
  CheckIcon,
  HStack,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface ToolApprovedMessageProps {
  message: ApprovalResponseMessage;
}

export function ToolApprovedMessage(props: ToolApprovedMessageProps) {
  const { message } = props;
  const t = useTranslations('components/Messages/ToolApprovedMessage');

  return (
    <VStack paddingX="small" fullWidth color="background-grey" border padding="xxsmall" >
      <HStack gap align="center">
        {message.approve ? (
          <CheckIcon size="xsmall" color="positive" />
        ) : (
          <CancelIcon size="xsmall" color="destructive" />
        )}
        <Typography bold variant="body3">
          {message.approve ? t('approved') : t('rejected')}
        </Typography>
      </HStack>
      {!!message.reason && (
        <HStack gap="small">
          <Typography color="muted" variant="body4" italic>
            {message.reason}
          </Typography>
        </HStack>
      )}
    </VStack>
  );
}
