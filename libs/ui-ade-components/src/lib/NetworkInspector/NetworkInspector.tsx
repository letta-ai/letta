'use client';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { ADEGroup } from '../shared/ADEGroup/ADEGroup';
import {
  Alert,
  Badge,
  CaretDownIcon,
  CaretRightIcon,
  CopyButton,
  HStack,
  JSONViewer,
  MiddleTruncate,
  Typography,
  Button,
  VStack,
  CloseIcon,
  InfoTooltip,
} from '@letta-cloud/ui-component-library';
import {
  useCurrentAPIHostConfig,
  useFormatters,
} from '@letta-cloud/utils-client';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useNetworkInspectorVisibility } from '../hooks/useNetworkInspectorVisibility/useNetworkInspectorVisibility';
import {
  useNetworkRequest,
  type NetworkRequest,
} from '../hooks/useNetworkRequest/useNetworkRequest';
import { atom, useAtom } from 'jotai';
import React from 'react';

interface RequestItemProps {
  request: NetworkRequest;
  expanded?: boolean;
  onToggle?: () => void;
}

interface RequestSectionProps {
  title: string;
  copyData?: Record<string, unknown>;
  children: React.ReactNode;
}

function RequestSection(props: RequestSectionProps) {
  const { title, children, copyData } = props;

  const t = useTranslations('ADE/NetworkInspector');
  return (
    <VStack gap={false}>
      <HStack
        align="center"
        justify="spaceBetween"
        padding="xsmall"
        color="background-grey2"
      >
        <Typography variant="body3" bold>
          {title}
        </Typography>
        {copyData && (
          <CopyButton
            copyButtonText={t('copyText', { type: title })}
            size="xsmall"
            textToCopy={JSON.stringify(copyData, null, 2)}
            hideLabel
          />
        )}
      </HStack>
      <VStack className="max-h-[200px]" overflowY="auto" padding="xsmall">
        <div style={{ fontSize: '12px' }}>{children}</div>
      </VStack>
    </VStack>
  );
}

function RequestItem(props: RequestItemProps) {
  const { request, expanded, onToggle } = props;

  const { isLocal } = useCurrentAgentMetaData();

  const { formatTime } = useFormatters();
  const t = useTranslations('ADE/NetworkInspector');

  const url = useMemo(() => {
    // if route contains agent-id, return a middletruncated version of the URL

    const agentIdRegex = /\/v1\/agents\/([a-zA-Z0-9-]+)\/[a-zA-Z0-9]+/;

    const match = agentIdRegex.exec(request.url);

    if (match) {
      // split the URL into parts
      // extract the agent ID
      const agentId = match[1];

      const parts = request.url.split(match[1]);

      return (
        <span>
          {parts[0]}
          <MiddleTruncate visibleStart={2} visibleEnd={5}>
            {agentId}
          </MiddleTruncate>
          {parts[1] ? parts[1] : ''}
        </span>
      );
    }

    return request.url;
  }, [request.url]);

  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: true,
  });

  return (
    <VStack border={expanded} gap={false}>
      <HStack
        as="button"
        padding="xxsmall"
        border={!expanded ? 'transparent' : false}
        borderBottom={expanded}
        color={expanded ? 'background-grey2' : 'transparent'}
        onClick={onToggle}
        align="center"
        fullWidth
        gap="small"
      >
        <HStack gap="text" align="center">
          {!expanded ? <CaretRightIcon /> : <CaretDownIcon />}
          <div className="w-[65px]">
            <Typography
              fullWidth
              align="right"
              variant="body3"
              color="muted"
              noWrap
            >
              {formatTime(request.date, {
                second: '2-digit',
                minute: '2-digit',
                hour: '2-digit',
              })}
            </Typography>
          </div>
        </HStack>
        <Badge size="small" uppercase content={request.method} />
        <Typography noWrap fullWidth overflow="ellipsis" variant="body3">
          {url}
        </Typography>
        <Badge
          size="small"
          content={request.status}
          variant={
            request.status >= 200 && request.status < 300
              ? 'success'
              : 'destructive'
          }
        />
      </HStack>
      {expanded && (
        <VStack gap={false}>
          {request.payload && (
            <RequestSection copyData={request.payload} title={t('request')}>
              <JSONViewer data={request.payload} />
            </RequestSection>
          )}
          <RequestSection copyData={request.response} title={t('response')}>
            <JSONViewer data={request.response} />
          </RequestSection>
          <HStack
            color="background-grey2"
            justify="end"
            fullWidth
            borderBottom
            padding="xsmall"
          >
            <CopyButton
              size="xsmall"
              color="secondary"
              textToCopy={jsonToCurl({
                ...hostConfig,
                headers: {
                  ...hostConfig.headers,
                  'content-type': 'application/json',
                },
                method: request.method,
                body: request.payload,
              })}
              copyButtonText={t('copyCurl')}
            />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}

interface RequestListProps {
  networkLogs: NetworkRequest[];
}

export const expandedRequestIdAtom = atom<string | null>(null);

function RequestList(props: RequestListProps) {
  const { networkLogs } = props;
  const [expandedRequestId, setExpandedRequestId] = useAtom(
    expandedRequestIdAtom,
  );

  const t = useTranslations('ADE/NetworkInspector');

  if (!networkLogs || networkLogs.length === 0) {
    return (
      <VStack overflowY="auto" fullHeight fullWidth padding="xsmall">
        <Alert title={t('noRequestsInfo.title')} variant="info">
          {t('noRequestsInfo.description')}
        </Alert>
      </VStack>
    );
  }

  return (
    <VStack overflowY="auto" fullHeight fullWidth padding="xsmall">
      {networkLogs.map((request, index) => (
        <RequestItem
          key={request.id || index}
          request={request}
          expanded={expandedRequestId === request.id}
          onToggle={() => {
            setExpandedRequestId((existingId) => {
              if (existingId === request.id) {
                return null;
              }
              return request.id || null;
            });
          }}
        />
      ))}
      {networkLogs.length === 0 && <span>{t('noRequests')}</span>}
    </VStack>
  );
}

export function NetworkInspector() {
  const { networkRequests } = useNetworkRequest();

  const t = useTranslations('ADE/NetworkInspector');

  const [networkInspectorState, setNetworkInspectorState] =
    useNetworkInspectorVisibility();
  const [, setExpandedRequestId] = useAtom(expandedRequestIdAtom);

  React.useEffect(() => {
    const { expandRequestId } = networkInspectorState;

    if (!expandRequestId) {
      return;
    }

    if (networkInspectorState.isOpen) {
      setExpandedRequestId(expandRequestId);
      setNetworkInspectorState((prev) => ({
        ...prev,
        expandRequestId: null,
      }));
      return;
    }

    if (networkRequests.length > 0) {
      const requestExists = networkRequests.some(
        (req) => req.id === expandRequestId,
      );
      if (requestExists) {
        setExpandedRequestId(expandRequestId);
        setNetworkInspectorState((prev) => ({
          ...prev,
          expandRequestId: null,
        }));
      }
    }
  }, [
    networkInspectorState,
    networkInspectorState.isOpen,
    networkInspectorState.expandRequestId,
    networkRequests,
    setExpandedRequestId,
    setNetworkInspectorState,
  ]);

  return (
    <ADEGroup
      items={[
        {
          id: 'network-inspector',
          title: (
            <HStack as="span" align="center">
              {t('title')}
              <InfoTooltip text={t('description')} />
            </HStack>
          ),
          badge: (
            <HStack>
              <Button
                size="xsmall"
                hideLabel
                label={t('close')}
                preIcon={<CloseIcon />}
                color="tertiary"
                onClick={() => {
                  setNetworkInspectorState({
                    isOpen: false,
                    expandRequestId: null,
                  });
                }}
              />
            </HStack>
          ),
          content: <RequestList networkLogs={networkRequests} />,
        },
      ]}
    />
  );
}
