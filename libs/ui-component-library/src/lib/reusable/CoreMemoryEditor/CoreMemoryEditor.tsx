'use client';
import * as React from 'react';
import type { Block } from '@letta-cloud/sdk-core';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { InfoChip } from '../../core/InfoChip/InfoChip';
import { useTranslations } from '@letta-cloud/translations';
import {
  CaretDownIcon,
  CaretUpIcon,
  EyeOpenIcon,
  InvaderSharedAgentIcon,
  LockClosedIcon,
  LockOpenRightIcon,
  MoveUpIcon,
  SplitscreenRightIcon,
  VisibilityLockIcon,
} from '../../icons';
import { VStack } from '../../framing/VStack/VStack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { InlineTextDiff } from '../../core/InlineTextDiff/InlineTextDiff';
import { cn } from '@letta-cloud/ui-styles';
import { Button } from '../../core/Button/Button';
import type { SharedAgent } from './SharedAgentsPopover/SharedAgentsPopover';
import { SharedAgentsPopover } from './SharedAgentsPopover/SharedAgentsPopover';
import { useVisibleMemoryTypeContext } from './useVisibleMemoryTypeContext/useVisibleMemoryTypeContext';

interface LimitProps {
  limit: number;
  value: string;
}

function Limit(props: LimitProps) {
  const { limit, value } = props;

  const t = useTranslations('components/CoreMemoryEditor');

  const tooltip = useMemo(() => {
    if (limit > value.length) {
      return t('CoreMemoryEditorHeader.limit.tooltip.normal', {
        limit,
        value,
      });
    }

    return t('CoreMemoryEditorHeader.limit.tooltip.overage', {
      limit,
      value,
    });
  }, [limit, value, t]);

  return (
    <Tooltip content={tooltip}>
      <Typography
        color={limit > value.length ? 'muted' : 'destructive'}
        variant="body4"
      >
        {t('CoreMemoryEditorHeader.limit.label', {
          value: value.length,
        })}
      </Typography>
    </Tooltip>
  );
}

interface DescriptionViewProps {
  description: string;
}

function DescriptionView(props: DescriptionViewProps) {
  const { description } = props;
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations('components/CoreMemoryEditor');

  return (
    <HStack
      padding="xsmall"
      gap="small"
      className="border rounded-[2px] bg-background-grey2 dark:bg-card-background border-background-grey2-border dark:border-background-grey3-border"
    >
      <Tooltip
        content={
          expanded
            ? t('DescriptionView.clickToCollapse')
            : t('DescriptionView.clickToExpand')
        }
      >
        <Typography
          color="lighter"
          onClick={() => {
            setExpanded((v) => !v);
          }}
          variant="body4"
          className={expanded ? '' : 'line-clamp-2'}
        >
          {description}
        </Typography>
      </Tooltip>
    </HStack>
  );
}

interface CollapseControllerProps {
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
}

function CollapseController(props: CollapseControllerProps) {
  const { isCollapsed, onCollapseChange } = props;

  const t = useTranslations('components/CoreMemoryEditor');

  const tooltip = useMemo(() => {
    return isCollapsed
      ? t('CollapseController.tooltip.expanded')
      : t('CollapseController.tooltip.collapse');
  }, [isCollapsed, t]);

  return (
    <Tooltip asChild content={tooltip}>
      <button
        onClick={() => {
          onCollapseChange(!isCollapsed);
        }}
        aria-label={tooltip}
      >
        {isCollapsed ? (
          <CaretDownIcon color="muted" />
        ) : (
          <CaretUpIcon color="muted" />
        )}
      </button>
    </Tooltip>
  );
}

interface CoreMemoryEditorHeaderProps {
  memoryBlock: Block;
  disabled?: boolean;
  sharedAgents: SharedAgent[];
  isLocked: boolean;
  editedValue: string;
  openInAdvanced?: VoidFunction;
  hideHeaderChips?: boolean;
  isCollapsed: boolean;
  hasSimulatedDiff: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onLockChange: (locked: boolean) => void;
}

function CoreMemoryEditorHeader(props: CoreMemoryEditorHeaderProps) {
  const {
    memoryBlock,
    editedValue,
    isLocked,
    disabled,
    isCollapsed,
    hasSimulatedDiff = false,
    hideHeaderChips,
    onCollapseChange,
    openInAdvanced,
    onLockChange,
    sharedAgents,
  } = props;
  const { label, limit, read_only, preserve_on_migration } = memoryBlock;
  const { setVisibleMemoryType } = useVisibleMemoryTypeContext();

  const t = useTranslations('components/CoreMemoryEditor');

  return (
    <HStack align="center" justify="spaceBetween" fullWidth>
      <HStack align="center" gap="small">
        <Typography semibold color="lighter" variant="body3">
          {label}
        </Typography>
        {!hideHeaderChips && (
          <HStack gap="small">
            <InfoChip
              onClick={() => {
                onLockChange(!isLocked);
              }}
              disabled={disabled}
              label={
                isLocked
                  ? t('CoreMemoryEditorHeader.isLocked.locked')
                  : t('CoreMemoryEditorHeader.isLocked.unlocked')
              }
              icon={isLocked ? <LockClosedIcon /> : <LockOpenRightIcon />}
            />
            {sharedAgents.length > 0 && (
              <SharedAgentsPopover
                agents={sharedAgents}
                trigger={
                  <InfoChip
                    as="div"
                    variant="brand"
                    value={`${sharedAgents.length}`}
                    label={t('CoreMemoryEditorHeader.sharedAgents', {
                      count: `${sharedAgents.length}`,
                    })}
                    icon={<InvaderSharedAgentIcon />}
                  />
                }
              ></SharedAgentsPopover>
            )}
            {read_only ? (
              <InfoChip
                onClick={openInAdvanced}
                label={t('CoreMemoryEditorHeader.readOnly')}
                icon={<VisibilityLockIcon />}
              />
            ) : (
              <InfoChip
                onClick={openInAdvanced}
                label={t('CoreMemoryEditorHeader.editable')}
                icon={<EyeOpenIcon />}
              />
            )}
            {preserve_on_migration && (
              <InfoChip
                onClick={openInAdvanced}
                label={t('CoreMemoryEditorHeader.preserved')}
                icon={<MoveUpIcon />}
              />
            )}
            {hasSimulatedDiff && (
              <InfoChip
                onClick={() => {
                  setVisibleMemoryType('agent');
                }}
                variant="brand"
                label={t('CoreMemoryEditorHeader.simulatedDiff')}
                icon={<SplitscreenRightIcon color="brand" />}
              />
            )}
          </HStack>
        )}
      </HStack>
      <HStack>
        <Limit limit={limit || 0} value={editedValue} />
        <CollapseController
          isCollapsed={isCollapsed}
          onCollapseChange={onCollapseChange}
        />
      </HStack>
    </HStack>
  );
}

const TEXTAREA_CLASSNAME =
  'w-full h-full resize-none  overflow-y-auto text-xs whitespace-pre-line inline-block border border-border p-2 text-lighter-text outline-none';

interface InlineMemoryDiffProps {
  value: string;
}

function InlineMemoryDiff(props: InlineMemoryDiffProps) {
  const { value } = props;
  const initialState = useRef<string>(value);

  useEffect(() => {
    const state = setTimeout(() => {
      initialState.current = value;
    }, 5000);

    return () => {
      clearTimeout(state);
    };
  }, [value]);

  return <InlineTextDiff text={initialState.current} comparedText={value} />;
}

interface CoreMemoryContentProps {
  value: string;
  onLockChange: (locked: boolean) => void;
  testId?: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onReset: () => void;
  isLocked: boolean;
  greyOutDisabledTextArea?: boolean;
  isDifferent?: boolean;
  showDiff?: boolean;
  disabled?: boolean;
}

function CoreMemoryContent(props: CoreMemoryContentProps) {
  const {
    disabled,
    value,
    greyOutDisabledTextArea,
    isDifferent,
    onValueChange,
    onReset,
    isSaving,
    onSave,
    onLockChange,
    showDiff,
    testId,
    isLocked,
  } = props;

  const t = useTranslations('components/CoreMemoryEditor');
  const [scrollTop, setScrollTop] = useState(0);

  if (disabled) {
    return (
      <div className={cn(TEXTAREA_CLASSNAME, 'relative')} data-testid={testId}>
        {showDiff ? <InlineMemoryDiff value={value} /> : value}
      </div>
    );
  }

  if (isLocked) {
    return (
      <Tooltip asChild content={t('CoreMemoryEditorContent.unlock')}>
        <div className="w-full h-full">
          <div
            onScroll={(e) => {
              setScrollTop(e.currentTarget.scrollTop);
            }}
            ref={(ref) => {
              if (ref) {
                ref.scrollTop = scrollTop;
              }
            }}
            onDoubleClick={() => {
              onLockChange(false);
            }}
            className={cn(
              TEXTAREA_CLASSNAME,
              'relative',
              greyOutDisabledTextArea
                ? 'bg-background-grey3'
                : 'bg-panel-input-background',
            )}
            data-testid={testId}
          >
            {showDiff ? <InlineMemoryDiff value={value} /> : value}
          </div>
        </div>
      </Tooltip>
    );
  }

  return (
    <>
      <div className="absolute right-0 bottom-0 pb-3 pr-2 z-[1]">
        <HStack gap="small">
          <Button
            color="secondary"
            size="small"
            data-testid={isDifferent ? `${testId}-reset` : `${testId}-lock`}
            type="button"
            _use_rarely_className="bg-background-grey"
            label={
              isDifferent
                ? t('CoreMemoryEditorContent.reset')
                : t('CoreMemoryEditorContent.lock')
            }
            onClick={onReset}
          />
          <Button
            size="small"
            data-testid={`${testId}-save`}
            type="button"
            busy={isSaving}
            label={t('CoreMemoryEditorContent.save')}
            onClick={onSave}
          />
        </HStack>
      </div>
      <textarea
        ref={(ref) => {
          if (ref) {
            ref.scrollTop = scrollTop;
          }
        }}
        onScroll={(e) => {
          setScrollTop(e.currentTarget.scrollTop);
        }}
        className={cn(
          TEXTAREA_CLASSNAME,
          'bg-panel-input-background',
          'absolute top-0',
        )}
        data-testid={testId}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
        }}
        placeholder={t('CoreMemoryEditorContent.placeholder')}
      />
      <div
        className={cn(
          TEXTAREA_CLASSNAME,

          'relative pointer-events-none z-[-1]',
        )}
      >
        {showDiff ? <InlineMemoryDiff value={value} /> : value}
      </div>
    </>
  );
}

interface ErrorViewProps {
  message: string;
}

function ErrorView(props: ErrorViewProps) {
  const { message } = props;

  return (
    <HStack padding="xsmall" color="destructive">
      <Typography variant="body3">{message}</Typography>
    </HStack>
  );
}

interface CoreMemoryEditorProps {
  memoryBlock: Block;
  disabled?: boolean;
  testId?: string;
  onSave: (value: string) => void;
  sharedAgents?: SharedAgent[];
  openInAdvanced?: VoidFunction;
  showDiff?: boolean;
  hasSimulatedDiff?: boolean;
  isSaving: boolean;
  hideDescription?: boolean;
  hideHeaderChips?: boolean;
  greyOutDisabledTextArea?: boolean;
  errorMessage?: string;
}

export function CoreMemoryEditor(props: CoreMemoryEditorProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    memoryBlock,
    sharedAgents = [],
    showDiff,
    isSaving,
    disabled,
    openInAdvanced,
    hasSimulatedDiff = false,
    testId,
    greyOutDisabledTextArea,
    onSave,
    hideDescription = false,
    hideHeaderChips = false,
    errorMessage,
  } = props;

  const [editedValue, setEditedValue] = useState<string>(memoryBlock.value);

  useEffect(() => {
    if (isLocked) {
      // we should always default to the memory block value if we're in a locked state
      setEditedValue(memoryBlock.value);
      return;
    }
  }, [isLocked, memoryBlock.value]);

  const handleSave = useCallback(() => {
    onSave(editedValue);
  }, [editedValue, onSave]);

  const handleReset = useCallback(() => {
    setEditedValue(memoryBlock.value);
    setIsLocked(true);
  }, [memoryBlock.value]);

  const isDifferent = useMemo(() => {
    return editedValue !== memoryBlock.value;
  }, [editedValue, memoryBlock.value]);

  return (
    <VStack
      gap={false}
      className={cn(!isCollapsed ? 'min-h-[150px]' : 'min-h-[30px]')}
      fullWidth
      overflow="hidden"
      fullHeight={!isCollapsed}
      borderBottom={isCollapsed}
    >
      <CoreMemoryEditorHeader
        onLockChange={setIsLocked}
        onCollapseChange={setIsCollapsed}
        isCollapsed={isCollapsed}
        sharedAgents={sharedAgents}
        memoryBlock={memoryBlock}
        hideHeaderChips={hideHeaderChips}
        disabled={disabled}
        openInAdvanced={openInAdvanced}
        hasSimulatedDiff={hasSimulatedDiff}
        editedValue={editedValue}
        isLocked={isLocked}
      />

      {!isCollapsed && (
        <div className="relative w-full overflow-hidden flex-col h-0 flex-1 flex gap-0.5">
          {memoryBlock.description && !hideDescription && (
            <DescriptionView description={memoryBlock.description || ''} />
          )}
          <VStack collapseHeight flex>
            <CoreMemoryContent
              showDiff={showDiff}
              disabled={disabled}
              onReset={handleReset}
              isDifferent={isDifferent}
              isSaving={isSaving}
              onSave={handleSave}
              greyOutDisabledTextArea={greyOutDisabledTextArea}
              value={editedValue}
              onValueChange={setEditedValue}
              testId={testId}
              isLocked={isLocked}
              onLockChange={setIsLocked}
            />
          </VStack>
          {errorMessage && <ErrorView message={errorMessage} />}
        </div>
      )}
    </VStack>
  );
}

export * from './useVisibleMemoryTypeContext/useVisibleMemoryTypeContext';
