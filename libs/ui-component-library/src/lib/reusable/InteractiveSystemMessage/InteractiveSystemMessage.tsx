import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { interactiveSystemMessageOpenAtom } from './interactiveSystemMessageOpenAtom';
import { useAtom } from 'jotai';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';

interface InteractiveSystemMessageProps {
  message: string;
  id: string;
}

export function InteractiveSystemMessage(props: InteractiveSystemMessageProps) {
  const { message, id } = props;
  const [openStates, setOpenStates] = useAtom(interactiveSystemMessageOpenAtom);

  const t = useTranslations('ui-component-library/InteractiveSystemMessage');

  const open = useMemo(() => {
    return openStates?.[id] || false;
  }, [id, openStates]);

  const toggleOpen = useCallback(() => {
    setOpenStates((prev) => ({ ...prev, [id]: !open }));
  }, [id, open, setOpenStates]);

  const shouldShowTruncated = useMemo(() => {
    return message.length > 500;
  }, [message]);

  const renderedMessage = useMemo(() => {
    if (!open) {
      return `${message.slice(0, 500)}...`;
    }

    return message;
  }, [message, open]);

  return (
    <VStack gap={false} fullWidth className="bg-background-grey3">
      <VStack color="background-grey2" padding="small" fullWidth>
        <Typography variant="body2">{renderedMessage}</Typography>
      </VStack>
      {shouldShowTruncated && (
        <HStack
          paddingX="small"
          as="button"
          paddingY="xxsmall"
          fullWidth
          gap="small"
          onClick={toggleOpen}
        >
          <Typography variant="body4">
            {open ? t('collapse') : t('truncated')}
          </Typography>
          {!open ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </HStack>
      )}
    </VStack>
  );
}
