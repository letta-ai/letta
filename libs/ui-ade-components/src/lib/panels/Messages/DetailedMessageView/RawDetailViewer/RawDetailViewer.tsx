import React, { useState } from 'react';
import {
  Button,
  CopyButton,
  ExpandContentIcon,
  HStack,
  JSONViewer,
  SideOverlay,
  SideOverlayHeader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { ProviderTrace } from '@letta-cloud/sdk-core';

interface RawDetailViewerProps {
  requestPayload: ProviderTrace['request_json'];
  responsePayload: ProviderTrace['response_json'];
}

interface GenericHeaderProps {
  text: string;
  copyText: string;
}

export function GenericHeader(props: GenericHeaderProps) {
  const { text, copyText } = props;

  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/RawDetailViewer',
  );

  return (
    <HStack
      justify="spaceBetween"
      paddingX="medium"
      paddingY="xsmall"
      borderY
      fullWidth
    >
      <Typography variant="body3" bold>
        {text}
      </Typography>
      <HStack>
        <CopyButton
          size="small"
          copyButtonText={t('copy', { label: text })}
          textToCopy={copyText}
        />
      </HStack>
    </HStack>
  );
}

export function RawDetailViewer(props: RawDetailViewerProps) {
  const { requestPayload, responsePayload } = props;
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/RawDetailViewer',
  );

  const memoizedRequestString = React.useMemo(() => {
    return JSON.stringify(requestPayload, null, 2);
  }, [requestPayload]);

  const memoizedResponseString = React.useMemo(() => {
    return JSON.stringify(responsePayload, null, 2);
  }, [responsePayload]);

  return (
    <>
      <Button
        label={t('trigger')}
        size="xsmall"
        hideLabel
        preIcon={<ExpandContentIcon />}
        color="tertiary"
        onClick={() => {
          setIsOpen(true);
        }}
      />
      <SideOverlay title={t('title')} isOpen={isOpen} onOpenChange={setIsOpen}>
        <VStack fullHeight fullWidth gap={false}>
          <SideOverlayHeader>
            <Typography bold variant="body2">
              {t('title')}
            </Typography>
          </SideOverlayHeader>
          <VStack
            padding="small"
            fullHeight
            fullWidth
            overflow="hidden"
            gap={false}
          >
            <VStack fullHeight fullWidth overflow="hidden" gap={false} border>
              <GenericHeader
                text={t('request')}
                copyText={memoizedRequestString}
              />
              <VStack overflowY="auto" flex collapseHeight padding>
                <JSONViewer data={requestPayload} />
              </VStack>
              <GenericHeader
                copyText={memoizedResponseString}
                text={t('response')}
              />
              <VStack overflowY="auto" flex collapseHeight padding>
                <JSONViewer data={responsePayload} />
              </VStack>
            </VStack>
          </VStack>
        </VStack>
      </SideOverlay>
    </>
  );
}
