import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TerminalIcon,
} from '../../icons';
import { Typography } from '../../core/Typography/Typography';
import { RawCodeEditor } from '../../core/Code/Code';
import { useTranslations } from 'next-intl';
import { Badge } from '../../core/Badge/Badge';
import { Spinner } from '../../core/Spinner/Spinner';

interface FunctionCallProps {
  name: string;
  inputs: string;
  response?: string;
}

export function FunctionCall(props: FunctionCallProps) {
  const { name, inputs, response } = props;
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('component-library/FunctionCall');

  return (
    <details
      className="bg-background w-full"
      open={open}
      onClick={() => {
        setOpen(!open);
      }}
    >
      <HStack as="summary">
        <HStack
          gap="large"
          align="center"
          color="background-grey"
          className="px-2 py-2 cursor-pointer"
        >
          <HStack gap="small">
            {open ? (
              <ChevronRightIcon size="small" />
            ) : (
              <ChevronDownIcon size="small" />
            )}
            <TerminalIcon size="small" />
            <Typography bold variant="body">
              {name}
            </Typography>
          </HStack>
          <Badge
            preIcon={
              !response ? <Spinner size="small" /> : <CheckIcon size="small" />
            }
            content={response ? t('completed') : t('isExecuting')}
            color={response ? 'success' : 'warning'}
          />
        </HStack>
      </HStack>
      <VStack color="background-grey" border gap={false}>
        <VStack gap={false}>
          <VStack paddingX="medium" paddingTop="small">
            <Typography variant="body2" bold>
              {t('request')}
            </Typography>
          </VStack>
          <RawCodeEditor
            hideLabel
            color="background-grey"
            variant="minimal"
            fullWidth
            showLineNumbers={false}
            fontSize="small"
            label=""
            language="javascript"
            code={inputs}
          />
        </VStack>
        {response && (
          <VStack borderTop gap={false}>
            <VStack paddingX="medium" paddingTop="small">
              <Typography variant="body2" bold>
                {t('response')}
              </Typography>
            </VStack>
            <RawCodeEditor
              hideLabel
              color="background-grey"
              variant="minimal"
              fullWidth
              label=""
              language="javascript"
              showLineNumbers={false}
              fontSize="small"
              code={response}
            />
          </VStack>
        )}
      </VStack>
    </details>
  );
}
