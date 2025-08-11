'use client';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CogIcon,
  DataObjectIcon,
  ExternalLinkIcon,
  HStack,
  RawCodeEditor,
  SegmentIcon,
  TabGroup,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import { useTranslations } from '@letta-cloud/translations';
import { ToolSettings } from '../ToolsSettings/ToolSettings';
import type { Tool } from '@letta-cloud/sdk-core';
import { selectedServerKeyAtom } from '../../routes/MCPServers/MCPServers';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { useAtom } from 'jotai/index';

interface MCPToolViewerProps {
  tags: string[];
  name: string;
  description: string;
  attachedId: string;
  tool: Tool;
}

interface MCPToolContentProps {
  serverName?: string;
  description: string;
  name: string;
}

function MCPToolContent(props: MCPToolContentProps) {
  const { serverName, description } = props;

  const { setPath } = useToolManagerState();

  const t = useTranslations('ToolManager/MCPToolViewer');
  const [_, setSelectedServerKey] = useAtom(selectedServerKeyAtom);

  if (!serverName) {
    return <Alert title={t('noServerFound')} />;
  }

  return (
    <VStack fullWidth gap="large" padding>
      <VStack gap="small" width="contained">
        <Typography variant="body3" bold>
          {t('description')}
        </Typography>

        <Typography>{description}</Typography>
      </VStack>
      <VStack gap="small" width="contained">
        <Typography variant="body3" bold>
          {t('serverName')}
        </Typography>
        <HStack align="center">
          <Typography>{serverName}</Typography>
          <Button
            preIcon={<ExternalLinkIcon />}
            hideLabel
            color="tertiary"
            size="xsmall"
            label={t('openServer')}
            onClick={() => {
              setPath(`/mcp-servers`);
              setSelectedServerKey(serverName);
            }}
          />
        </HStack>
      </VStack>
    </VStack>
  );
}

type EditMode = 'details' | 'json' | 'settings';

interface EditModesProps {
  setMode: (mode: EditMode) => void;
  mode: EditMode;
}

function EditModes(props: EditModesProps) {
  const { setMode, mode } = props;
  const t = useTranslations('ToolsEditor/LettaToolViewer');

  return (
    <TabGroup
      value={mode}
      onValueChange={(value) => {
        if (!value) {
          return;
        }
        setMode(value as EditMode);
      }}
      color="transparent"
      items={[
        {
          icon: <SegmentIcon />,
          label: t('ViewToggle.options.details'),
          value: 'details',
        },
        {
          icon: <DataObjectIcon />,
          label: t('ViewToggle.options.json'),
          value: 'json',
        },
        {
          icon: <CogIcon />,
          label: t('ViewToggle.options.settings'),
          value: 'settings',
        },
      ]}
    />
  );
}

interface MCPJSONSchemaViewerProps {
  tool: Tool;
}

function MCPJSONSchemaViewer(props: MCPJSONSchemaViewerProps) {
  const { tool } = props;

  const jsonSchemaString = useMemo(() => {
    return JSON.stringify(tool.json_schema || {}, null, 2);
  }, [tool.json_schema]);

  return (
    <RawCodeEditor
      fontSize="small"
      fullHeight
      fullWidth
      flex
      border={false}
      variant="minimal"
      label=""
      showLineNumbers={false}
      hideLabel
      language="javascript"
      code={jsonSchemaString}
    />
  );
}

export function MCPToolViewer(props: MCPToolViewerProps) {
  const { tags, attachedId, name, description, tool } = props;

  const serverName = useMemo(() => {
    return tags.find((tag) => tag.startsWith('mcp:'))?.split(':')[1];
  }, [tags]);

  const [editMode, setEditMode] = useState<EditMode>('details');

  return (
    <VStack gap={false} fullWidth fullHeight>
      <ToolActionsHeader
        idToAttach={`${serverName}:${attachedId}`}
        attachedId={attachedId}
        type="external_mcp"
        name={name}
      />
      <VStack fullWidth flex collapseHeight gap={false}>
        <HStack paddingX="medium" borderBottom>
          <EditModes setMode={setEditMode} mode={editMode} />
        </HStack>
        {editMode === 'details' ? (
          <MCPToolContent
            serverName={serverName}
            description={description}
            name={name}
          />
        ) : editMode === 'json' ? (
          <MCPJSONSchemaViewer tool={tool} />
        ) : (
          <ToolSettings showDelete={false} showSave tool={tool} />
        )}
      </VStack>
    </VStack>
  );
}
