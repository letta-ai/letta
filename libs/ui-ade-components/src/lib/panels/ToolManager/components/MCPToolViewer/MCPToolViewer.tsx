import React, { useMemo, useState } from 'react';
import {
  Alert,
  CogIcon,
  HStack,
  McpIcon,
  RawToggleGroup,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import { useTranslations } from '@letta-cloud/translations';
import { ToolSettings } from '../ToolsSettings/ToolSettings';
import type { Tool } from '@letta-cloud/sdk-core';

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
  const { serverName, description, name } = props;

  const t = useTranslations('ToolManager/MCPToolViewer');

  if (!serverName) {
    return <Alert title={t('noServerFound')} />;
  }

  return (
    <VStack fullWidth padding>
      <HStack align="center" justify="spaceBetween">
        <HStack gap="large" align="center">
          <HStack
            color="background-grey"
            className="w-[64px] h-[64px]"
            align="center"
            justify="center"
          >
            <McpIcon />
          </HStack>
          <VStack gap={false}>
            <Typography>{name}</Typography>
            <Typography>{serverName}</Typography>
          </VStack>
        </HStack>
      </HStack>
      <VStack width="contained">
        <Typography>{description}</Typography>
      </VStack>
    </VStack>
  );
}

type EditMode = 'details' | 'settings';

interface EditModesProps {
  setMode: (mode: EditMode) => void;
  mode: EditMode;
}

function EditModes(props: EditModesProps) {
  const { setMode, mode } = props;
  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  return (
    <RawToggleGroup
      vertical
      label={t('EditModes.label')}
      hideLabel
      value={mode}
      onValueChange={(value) => {
        if (!value) {
          return;
        }
        setMode(value as EditMode);
      }}
      size="small"
      items={[
        {
          hideLabel: true,
          icon: <McpIcon />,
          label: t('EditModes.modes.details'),
          value: 'details',
        },
        {
          hideLabel: true,
          icon: <CogIcon />,
          label: t('EditModes.modes.settings'),
          value: 'settings',
        },
      ]}
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
    <VStack fullWidth fullHeight gap={false}>
      <ToolActionsHeader
        idToAttach={`${serverName}:${attachedId}`}
        attachedId={attachedId}
        type="external_mcp"
        name={name}
      />
      <HStack fullWidth fullHeight>
        {editMode === 'details' ? (
          <MCPToolContent
            serverName={serverName}
            description={description}
            name={name}
          />
        ) : (
          <ToolSettings showDelete={false} showSave tool={tool} />
        )}
        <VStack borderLeft fullHeight padding="xxsmall" color="background-grey">
          <EditModes setMode={setEditMode} mode={editMode} />
        </VStack>
      </HStack>
    </VStack>
  );
}
