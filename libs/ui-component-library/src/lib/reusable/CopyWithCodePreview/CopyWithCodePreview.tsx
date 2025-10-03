import * as React from 'react';
import type { PopoverProps } from '../../core/Popover/Popover';
import { Popover } from '../../core/Popover/Popover';
import type { ButtonProps } from '../../core/Button/Button';
import { Button } from '../../core/Button/Button';
import { useTranslations } from '@letta-cloud/translations';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import type { SupportedLangauges } from '../../core/Code/Code';
import { Code } from '../../core/Code/Code';
import { CheckIcon, CodeIcon, CopyIcon } from '../../icons';
import { useCopyToClipboard } from '../../hooks';
import { HStack } from '../../framing/HStack/HStack';

interface CopyWithCodePreviewProps {
  buttonProps?: Omit<ButtonProps, 'label'>;
  copyTextLabel: string;
  code: string;
  language: SupportedLangauges;
  align?: PopoverProps['align'];
  side?: PopoverProps['side'];
}

export function CopyWithCodePreview(props: CopyWithCodePreviewProps) {
  const { buttonProps, code, side, align, language, copyTextLabel } = props;
  const [isHovered, setIsHovered] = React.useState(false);
  const t = useTranslations('ui-component-library/CopyWithCodePreview');

  const { copyToClipboard, isCopied } = useCopyToClipboard({
    textToCopy: code,
  });

  return (
    <Popover
      open={isHovered}
      onOpenChange={setIsHovered}
      side={side}
      align={align}
      triggerAsChild
      className="max-w-[500px] shadow-sm w-full"
      trigger={
        <Button
          color="secondary"
          type="button"
          preIcon={isCopied ? <CheckIcon /> : <CopyIcon />}
          _use_rarely_disableTooltip
          onClick={(e) => {
            e.stopPropagation();
            void copyToClipboard();
          }}
          {...buttonProps}
          label={copyTextLabel}
          hideLabel
          onMouseEnter={() => {
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
        />
      }
    >
      <VStack padding="xsmall" color="background" gap="small" className="rounded-lg" fullWidth>

        <VStack
          color="background-grey"
          border
        >
          <Code
            variant="minimal"
            fontSize="small"
            color="background-grey"
            language={language}
            code={code}
            showLineNumbers={false}
          />
        </VStack>
        <HStack padding="small" fullWidth border align="center">
          <CodeIcon />
          <Typography bold variant="body2" noWrap>
            {t('description')}
          </Typography>
        </HStack>
      </VStack>
    </Popover>
  );
}
