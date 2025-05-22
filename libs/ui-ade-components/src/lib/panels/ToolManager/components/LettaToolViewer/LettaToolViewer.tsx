import type { Tool } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../hooks';
import React, { useMemo, useState } from 'react';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import {
  CogIcon,
  DataObjectIcon,
  HStack,
  LettaLogoIcon,
  RawCodeEditor,
  RawToggleGroup,
  SegmentIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ToolSettings } from '../ToolsSettings/ToolSettings';

type ViewMode = 'details' | 'json' | 'settings';

interface ViewToggleProps {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  type: Tool['tool_type'];
}

function ViewToggle(props: ViewToggleProps) {
  const { mode, type, setMode } = props;
  const t = useTranslations('ToolsEditor/LettaToolViewer');

  return (
    <RawToggleGroup
      onValueChange={(value) => {
        if (!value) {
          return;
        }

        setMode(value as ViewMode);
      }}
      size="small"
      vertical
      value={mode}
      hideLabel
      fullHeight
      label={t('ViewToggle.label')}
      items={[
        {
          icon: <SegmentIcon />,
          hideLabel: true,
          label: t('ViewToggle.options.details'),
          value: 'details',
        },
        {
          icon: <DataObjectIcon />,
          hideLabel: true,
          label: t('ViewToggle.options.json'),
          value: 'json',
        },
        ...(type === 'letta_builtin'
          ? [
              {
                icon: <CogIcon />,
                hideLabel: true,
                label: t('ViewToggle.options.settings'),
                value: 'settings',
              },
            ]
          : []),
      ]}
    />
  );
}

interface LettaToolContentProps {
  tool: Tool;
  mode: ViewMode;
}

function LettaToolContent(props: LettaToolContentProps) {
  const { tool, mode } = props;

  switch (mode) {
    case 'details':
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
                <LettaLogoIcon />
              </HStack>
              <VStack gap={false}>
                <Typography>{tool.name}</Typography>
                <Typography>Letta</Typography>
              </VStack>
            </HStack>
          </HStack>
          <VStack width="contained">
            <Typography>{tool.description}</Typography>
          </VStack>
        </VStack>
      );
    case 'json':
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
          code={JSON.stringify(tool.json_schema || {}, null, 2)}
        />
      );
    case 'settings':
      return <ToolSettings showDelete={false} showSave tool={tool} />;
  }
}

interface LettaToolViewerProps {
  tool: Tool;
}

export function LettaToolViewer(props: LettaToolViewerProps) {
  const { tool } = props;

  const { tools } = useCurrentAgent();

  const [mode, setMode] = useState<ViewMode>('details');

  const isAttached = useMemo(() => {
    return tools?.some((t) => t.id === tool.id);
  }, [tools, tool.id]);

  return (
    <VStack gap={false} fullWidth fullHeight>
      <ToolActionsHeader
        idToAttach={tool.id || ''}
        attachedId={isAttached ? tool.id : undefined}
        type={tool.tool_type || 'custom'}
        name={tool.name || ''}
      />
      <HStack fullWidth fullHeight>
        <LettaToolContent tool={tool} mode={mode} />
        <VStack borderLeft fullHeight padding="xxsmall" color="background-grey">
          <ViewToggle type={tool.tool_type} mode={mode} setMode={setMode} />
        </VStack>
      </HStack>
    </VStack>
  );
}
