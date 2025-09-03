import { HStack, Tooltip, Typography } from '@letta-cloud/ui-component-library';
import type { Source } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { UpdateSourceInstructionsModal } from '../../UpdateSourceInstructionsModal';

interface InstructionsViewProps {
  source: Source;
}

export function InstructionsView(props: InstructionsViewProps) {
  const { source } = props;

  const t = useTranslations('ADE/InstructionsView');

  const instructions = useMemo(() => {
    return source?.instructions || t('addInstructions');
  }, [source?.instructions, t]);

  return (
    <UpdateSourceInstructionsModal
      source={source}
      trigger={
        <button className="w-full text-left">
          <Tooltip asChild content={t('instructionsTooltip')}>
            <HStack
              align="center"
              color="background-grey2"
              border
              paddingLeft="xsmall"
              paddingY="xxsmall"
              fullWidth
              className="border-background-grey2-border dark:border-background-grey3-border cursor-pointer hover:opacity-80 transition-opacity"
            >
              <HStack fullWidth align="center" as="span">
                <Typography
                  className="line-clamp-2"
                  color="lighter"
                  variant="body3"
                  overrideEl="span"
                >
                  {instructions}
                </Typography>
              </HStack>
            </HStack>
          </Tooltip>
        </button>
      }
    />
  );
}
