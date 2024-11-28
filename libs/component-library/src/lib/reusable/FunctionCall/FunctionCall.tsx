import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TerminalIcon,
  WarningIcon,
} from '../../icons';
import { Typography } from '../../core/Typography/Typography';
import { RawCodeEditor } from '../../core/Code/Code';
import { useTranslations } from 'next-intl';
import { Spinner } from '../../core/Spinner/Spinner';
import { useMemo } from 'react';

interface FunctionCallProps {
  name: string;
  inputs: string;
  response?: string;
  status?: string;
}

export function FunctionCall(props: FunctionCallProps) {
  const { name, inputs, response, status } = props;
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('component-library/FunctionCall');

  const statusMessage = useMemo(() => {
    if (!response) {
      return t('isExecuting');
    }

    if (status === 'success') {
      return t('success');
    }

    return t('error');
  }, [response, status, t]);

  const statusColor = useMemo(() => {
    if (!response) {
      return 'warning';
    }

    if (status === 'success') {
      return 'success';
    }

    return 'destructive';
  }, [response, status]);

  const statusIcon = useMemo(() => {
    if (!response) {
      return <Spinner size="small" />;
    }

    if (status === 'success') {
      return <CheckIcon size="small" />;
    }

    return <WarningIcon />;
  }, [response, status]);

  return (
    <details
      className="bg-background w-full"
      open={open}
      onToggle={(e) => {
        e.preventDefault();
        setOpen(!open);
      }}
    >
      <HStack as="summary">
        <HStack className="h-[40px]" gap={false}>
          <HStack
            gap="large"
            align="center"
            color="background-grey"
            className="px-2 pr-3 py-2 cursor-pointer"
          >
            <HStack gap="small">
              {!open ? (
                <ChevronRightIcon size="small" />
              ) : (
                <ChevronDownIcon size="small" />
              )}
              <TerminalIcon size="small" />
              <Typography bold variant="body">
                {name}
              </Typography>
            </HStack>
          </HStack>
          <HStack
            color={statusColor}
            align="center"
            justify="center"
            className="w-[40px] h-[40px]"
          >
            <div className="sr-only">{statusMessage}</div>
            {statusIcon}
          </HStack>
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
