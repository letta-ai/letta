import {
  Button,
  EditIcon,
  HStack,
  InfoTooltip,
  Typography,
} from '@letta-cloud/ui-component-library';
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
    <HStack align="center" color="background-grey2" border paddingLeft="xsmall">
      <HStack fullWidth align="center">
        <Typography className="line-clamp-2" color="lighter" variant="body3">
          {instructions}
        </Typography>
        {!source?.instructions && (
          <InfoTooltip text={t('instructionsTooltip')} />
        )}
      </HStack>
      <UpdateSourceInstructionsModal
        source={source}
        trigger={
          <Button
            size="xsmall"
            label={t('editInstructions')}
            preIcon={<EditIcon />}
            color="tertiary"
            hideLabel
          />
        }
      />
    </HStack>
  );
}
