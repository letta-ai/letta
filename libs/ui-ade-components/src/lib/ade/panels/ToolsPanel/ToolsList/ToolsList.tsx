import { useCurrentAgent } from '../../../../hooks';
import { useToolManagerState } from '@letta-cloud/ui-ade-components';
import { useTranslations } from '@letta-cloud/translations';
import React, { useMemo } from 'react';
import { isLettaTool, type Tool, type ToolType } from '@letta-cloud/sdk-core';
import { SpecificToolIcon } from '../../ToolManager/components/SpecificToolIcon/SpecificToolIcon';
import {
  ApprovalDelegationIcon,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  LinkOffIcon,
  LoadingEmptyStatusComponent,
  Tooltip,
  Typography,
  VerticalDotsIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { DetachToolDialog } from '../../ToolManager/components/DetachToolDialog/DetachToolDialog';
import { EnableHITLForToolDialog } from '../components/EnableHITLForToolDialog/EnableHITLForToolDialog';
import { DisableHITLForToolDialog } from '../components/DisableHITLForToolDialog/DisableHITLForToolDialog';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface ToolAccordionProps {
  tools: ParsedTool[];
}

function ToolListInner(props: ToolAccordionProps) {
  const { tools } = props;
  const t = useTranslations('ToolManager/SingleMCPServer');

  return (
    <VStack paddingY="xsmall" gap="small">
      {tools.map((tool) => (
        <HStack
          justify="spaceBetween"
          color="background-grey2"
          align="center"
          paddingLeft="small"
          paddingRight="xxsmall"
          paddingY="xxsmall"
          border
          key={tool.id}
        >
          <HStack
            fullHeight
            onClick={tool.onClick}
            as="button"
            align="center"
            collapseWidth
            flex
            gap="small"
          >
            <SpecificToolIcon
              size="xsmall"
              toolType={tool.type}
              sourceType={tool.sourceType}
            />
            <Typography
              noWrap
              fullWidth
              overflow="ellipsis"
              bold
              variant="body3"
              data-testid={`tool-attached:${tool.name}`}
            >
              {tool.name}
            </Typography>
            {tool.isNonStrict && (
              <Tooltip
                content={t('ServerToolsList.schemaHealth.notStrict.tooltip')}
              >
                <Badge
                  variant="warning"
                  size="small"
                  content={t('ServerToolsList.schemaHealth.notStrict.label')}
                />
              </Tooltip>
            )}
          </HStack>
          <HStack>{tool.actionNode}</HStack>
        </HStack>
      ))}
    </VStack>
  );
}

function useIsHumanInTheLoopEnabledForTool(toolName: string) {
  const { tool_rules } = useCurrentAgent();

  return useMemo(() => {
    if (!tool_rules) {
      return false;
    }

    return tool_rules.some(
      (rule) =>
        rule.tool_name === toolName && rule.type === 'requires_approval',
    );
  }, [tool_rules, toolName]);
}

interface ToolOptionsProps {
  tool: Tool;
}

function ToolOptions(props: ToolOptionsProps) {
  const { tool } = props;
  const isReadOnlyTool = tool.tool_type !== 'custom';

  const t = useTranslations('ADE/Tools.ToolsList.ToolOptions');
  const { openToolManager } = useToolManagerState();

  const toolRequiresApproval = useIsHumanInTheLoopEnabledForTool(
    tool.name || '',
  );

  const { data: isEnabled } = useFeatureFlag('HUMAN_IN_THE_LOOP');

  return (
    <DropdownMenu
      triggerAsChild
      align="end"
      trigger={
        <Button
          size="xsmall"
          label={t('options')}
          preIcon={<VerticalDotsIcon />}
          hideLabel
          color="tertiary"
        />
      }
    >
      {isEnabled && (
        <>
          {!toolRequiresApproval ? (
            <EnableHITLForToolDialog
              toolName={tool.name || ''}
              trigger={
                <DropdownMenuItem doNotCloseOnSelect label={t('enableHTIL')} />
              }
            />
          ) : (
            <DisableHITLForToolDialog
              toolName={tool.name || ''}
              trigger={
                <DropdownMenuItem doNotCloseOnSelect label={t('disableHTIL')} />
              }
            />
          )}
        </>
      )}
      <DetachToolDialog
        toolType={tool.tool_type || 'custom'}
        idToDetach={tool.id || ''}
        trigger={
          <DropdownMenuItem
            color="tertiary"
            label={t('detachTool')}
          />
        }
      />

      {isReadOnlyTool ? (
        <DropdownMenuItem
          label={t('edit')}
          onClick={() => {
            openToolManager('/current-agent-tools', tool.id);
          }}
        />
      ) : (
        <DropdownMenuItem
          label={t('view')}
          onClick={() => {
            openToolManager('/current-agent-tools', tool.id);
          }}
        />
      )}
    </DropdownMenu>
  );
}

interface IsHTILEnabledIconProps {
  toolName: string;
}

function IsHTILEnabledIcon(props: IsHTILEnabledIconProps) {
  const { toolName } = props;
  const toolRequiresApproval = useIsHumanInTheLoopEnabledForTool(toolName);
  const t = useTranslations('ADE/Tools.ToolsList.IsHTILEnabledIcon');

  if (!toolRequiresApproval) {
    return null;
  }

  return (
    <Button
      hideLabel
      label={t('tooltip')}
      preIcon={<ApprovalDelegationIcon />}
      size="xsmall"
      square
      color="tertiary"
    />
  );
}

// MCP Tool metadata constants for schema health status (matching backend)
const MCP_TOOL_TAG_NAME_PREFIX = 'mcp:';
const MCP_TOOL_METADATA_SCHEMA_STATUS = `${MCP_TOOL_TAG_NAME_PREFIX}SCHEMA_STATUS`;

interface ParsedTool {
  name: string;
  id: string;
  type: ToolType;
  sourceType?: string;
  icon: React.ReactNode;
  actionNode?: React.ReactNode;
  onClick?: () => void;
  isNonStrict?: boolean;
}

function getToolStrictModeInfo(tool: Tool): boolean {
  // Check if tool has json_schema
  if (!tool.json_schema) {
    return false;
  }

  // Check for MCP tool metadata
  const schemaStatus = tool.json_schema[MCP_TOOL_METADATA_SCHEMA_STATUS];
  if (schemaStatus === 'NON_STRICT_ONLY') {
    return true;
  }

  // Check the strict field directly
  // If strict is explicitly false, it's non-strict
  if (tool.json_schema.strict === false) {
    return true;
  }

  // Default to strict compliant
  return false;
}

interface ToolsListProps {
  search: string;
}

export function ToolsList(props: ToolsListProps) {
  const { search } = props;
  const { tools: currentTools } = useCurrentAgent();
  const { openToolManager } = useToolManagerState();

  const t = useTranslations('ADE/Tools');

  const toolsList: ParsedTool[] = useMemo(() => {
    if (!currentTools) {
      return [];
    }

    return currentTools
      .filter((tool) => {
        // Only filter by search, don't exclude any tool types
        if (!search) {
          return true;
        }

        const toolName = tool.name?.toLowerCase() || '';
        const searchLower = search.toLowerCase();

        return toolName.includes(searchLower);
      })
      .toSorted((a, b) => {
        // if tool_type includes letta, it should be sorted first
        if (isLettaTool(a.tool_type) && !isLettaTool(b.tool_type)) {
          return -1;
        }

        if (!isLettaTool(a.tool_type) && isLettaTool(b.tool_type)) {
          return 1;
        }

        // Otherwise, sort by name
        return a.name?.localeCompare(b.name || '') || 0;
      })
      .map((tool) => {
        const isNonStrict = getToolStrictModeInfo(tool);

        return {
          name: tool.name || '',
          id: tool.id || '',
          onClick: () => {
            openToolManager('/current-agent-tools', tool.id);
          },
          type: tool.tool_type || 'custom',
          sourceType: tool.source_type ?? undefined,
          icon: (
            <SpecificToolIcon
              toolType={tool.tool_type}
              sourceType={tool.source_type}
            />
          ),
          isNonStrict: isNonStrict,
          actionNode: (
            <HStack align="center" gap={false}>
              <IsHTILEnabledIcon toolName={tool.name || ''} />
              {tool.tool_type && tool.id && (
                <DetachToolDialog
                  toolType={tool.tool_type}
                  idToDetach={tool.id}
                  trigger={
                    <Button
                      data-testid={`detach-tool:${tool.name}`}
                      hideLabel
                      size="xsmall"
                      color="tertiary"
                      preIcon={<LinkOffIcon />}
                      label={t('ToolsList.removeTool')}
                    />
                  }
                />
              )}
              <ToolOptions tool={tool} />
            </HStack>
          ),
        };
      });
  }, [currentTools, openToolManager, search, t]);

  return (
    <VStack gap="medium" paddingX="medium" paddingBottom="small">
      {toolsList.length === 0 ? (
        <LoadingEmptyStatusComponent
          className="min-h-[250px]"
          loaderVariant="grower"
          isLoading={!currentTools}
          hideText={!currentTools}
          emptyMessage={
            search ? t('ToolsListPage.emptySearch') : t('ToolsListPage.empty')
          }
          emptyAction={
            <Button
              label={t('ToolsListPage.emptyAction')}
              color="secondary"
              size="xsmall"
              bold
              onClick={() => {
                openToolManager('/letta-tools');
              }}
            />
          }
        />
      ) : (
        <ToolListInner tools={toolsList} />
      )}
    </VStack>
  );
}
