'use client';
import type { Tool } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';
import React, { useMemo, useState } from 'react';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import {
  Badge,
  CogIcon,
  DataObjectIcon,
  HStack,
  Markdown,
  RawCodeEditor,
  SegmentIcon,
  TabGroup,
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
    <TabGroup
      onValueChange={(value) => {
        if (!value) {
          return;
        }

        setMode(value as ViewMode);
      }}
      color="transparent"
      value={mode}
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
        ...(type === 'letta_builtin'
          ? [
              {
                icon: <CogIcon />,
                hideLabel: false,
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

  const t = useTranslations('ToolsEditor/LettaToolViewer');

  switch (mode) {
    case 'details':
      return (
        <VStack gap="xlarge" fullWidth fullHeight padding overflow="auto">
          <VStack gap="small" width="contained">
            <Typography variant="body3" bold>
              {t('description')}
            </Typography>
            <Markdown text={tool.description || ''} />
          </VStack>
          <VStack gap="small" width="contained">
            <Typography variant="body3" bold>
              {t('type')}
            </Typography>
            <HStack>
              <Badge content={tool.tool_type} />
            </HStack>
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
      <VStack fullWidth flex collapseHeight gap={false}>
        <HStack paddingX="medium" borderBottom>
          <ViewToggle type={tool.tool_type} mode={mode} setMode={setMode} />
        </HStack>
        <VStack collapseHeight flex>
          <LettaToolContent tool={tool} mode={mode} />
        </VStack>
      </VStack>
    </VStack>
  );
}
