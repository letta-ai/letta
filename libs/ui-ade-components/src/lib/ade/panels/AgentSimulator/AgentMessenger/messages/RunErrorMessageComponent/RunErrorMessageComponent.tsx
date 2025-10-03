import { useGetRunErrorTranslation } from '../../hooks/useGetRunErrorTranslation/useGetRunErrorTranslation';
import type { RunErrorMessage } from '../../../../../../hooks/useAgentRunMessages/agentRunManager.types';
import { useMemo } from 'react';
import { HStack, Typography } from '@letta-cloud/ui-component-library';

interface RunErrorMessageProps {
  message: RunErrorMessage
}

export function RunErrorMessageComponent(props: RunErrorMessageProps) {
  const {  message } = props;
  const getRunErrorTranslation = useGetRunErrorTranslation();


  const response = useMemo(() => {
    return getRunErrorTranslation(message.error.type)
  }, [message, getRunErrorTranslation])


  return (
    <HStack border padding="small" className="bg-chip-destructive text-chip-destructive-content border-chip-destructive-border">
      <Typography variant="body2">
        {response}
      </Typography>
    </HStack>
  )

}
