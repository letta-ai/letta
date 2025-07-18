'use client';
import React, { useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  VStack,
  RawInput,
  SearchIcon,
  RawToggleGroup,
  Button,
  DropdownMenu,
  DropdownDetailedMenuItem,
  StartIcon,
  EndIcon,
  ChevronDownIcon,
  Popover,
  ConstrainChildToolsIcon,
  ContinueLoopIcon,
  MaxCountPerStepIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import type { SupportedToolRuleNameTypes } from './types';

// Extract filter options to a constant
const FILTER_OPTIONS = [
  { value: 'all', translationKey: 'toolTypes.allRules.title' },
  { value: 'continue_loop', translationKey: 'toolTypes.continueLoop.title' },
  {
    value: 'constrain_child_tools',
    translationKey: 'toolTypes.constrainChildTools.title',
  },
  { value: 'run_first', translationKey: 'toolTypes.runFirst.title' },
  { value: 'exit_loop', translationKey: 'toolTypes.exitLoop.title' },
  {
    value: 'max_count_per_step',
    translationKey: 'toolTypes.maxCountPerStep.title',
  },
  {
    value: 'required_before_exit',
    translationKey: 'toolTypes.requiredBeforeExit.title',
  },
] as const;

// Extract rule options to a constant
const RULE_OPTIONS = [
  {
    value: 'run_first' as const,
    icon: StartIcon,
    translationKey: 'toolTypes.runFirst',
  },
  {
    value: 'exit_loop' as const,
    icon: EndIcon,
    translationKey: 'toolTypes.exitLoop',
  },
  {
    value: 'required_before_exit' as const,
    icon: EndIcon,
    translationKey: 'toolTypes.requiredBeforeExit',
  },
  {
    value: 'constrain_child_tools' as const,
    icon: ConstrainChildToolsIcon,
    translationKey: 'toolTypes.constrainChildTools',
  },
  {
    value: 'continue_loop' as const,
    icon: ContinueLoopIcon,
    translationKey: 'toolTypes.continueLoop',
  },
  {
    value: 'max_count_per_step' as const,
    icon: MaxCountPerStepIcon,
    translationKey: 'toolTypes.maxCountPerStep',
  },
] as const;

// Types
type ViewMode = 'rules' | 'tools';
type FilterValue = (typeof FILTER_OPTIONS)[number]['value'];

interface ToolRulesSearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddRule?: (rule: SupportedToolRuleNameTypes) => void;
  filterBy?: FilterValue;
  onFilterChange?: (value: FilterValue) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

// New Rule Button Components
interface NewRuleButtonProps {
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface NewToolRuleButtonProps {
  onSelect: (rule: SupportedToolRuleNameTypes) => void;
}

interface FilterDropdownProps {
  filterBy?: FilterValue;
  onFilterChange?: (value: FilterValue) => void;
}

// Components
function NewRuleButton({
  onSelect,
  title,
  description,
  icon,
}: NewRuleButtonProps) {
  return (
    <DropdownDetailedMenuItem
      description={description}
      label={title}
      preIcon={icon}
      onClick={onSelect}
    />
  );
}

function NewToolRuleButton({ onSelect }: NewToolRuleButtonProps) {
  const t = useTranslations('ADE/ToolRules');

  return (
    <DropdownMenu
      triggerAsChild
      align="end"
      trigger={
        <Button
          size="small"
          postIcon={<ChevronDownIcon />}
          label={t('ToolRuleList.newRule')}
          color="secondary"
        />
      }
    >
      {RULE_OPTIONS.map(({ value, icon: Icon, translationKey }) => (
        <NewRuleButton
          key={value}
          onSelect={() => {
            onSelect(value);
          }}
          title={t(`${translationKey}.title`)}
          description={t(`${translationKey}.description`)}
          icon={<Icon size="small" color="default" />}
        />
      ))}
    </DropdownMenu>
  );
}

function FilterDropdown({ filterBy, onFilterChange }: FilterDropdownProps) {
  const t = useTranslations('ADE/ToolRules');

  const getFilterLabel = useCallback(
    (filterValue: FilterValue) => {
      const option = FILTER_OPTIONS.find((opt) => opt.value === filterValue);
      return option ? t(option.translationKey) : t('toolTypes.allRules.title');
    },
    [t],
  );

  const handleFilterChange = useCallback(
    (value: FilterValue) => {
      onFilterChange?.(value);
    },
    [onFilterChange],
  );

  return (
    /* eslint-disable-next-line react/forbid-component-props */
    <HStack border align="center" style={{ minWidth: '200px' }}>
      <Popover
        triggerAsChild
        align="start"
        className="w-[200px]"
        trigger={
          <Button
            size="small"
            color="tertiary"
            fullWidth
            /* eslint-disable-next-line react/forbid-component-props */
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            label={getFilterLabel(filterBy || 'all')}
            postIcon={<ChevronDownIcon />}
          />
        }
      >
        <VStack color="background-grey" gap={false}>
          {FILTER_OPTIONS.map(({ value, translationKey }) => (
            <Button
              key={value}
              fullWidth
              align="left"
              size="small"
              color="tertiary"
              label={t(translationKey)}
              onClick={() => {
                handleFilterChange(value);
              }}
            />
          ))}
        </VStack>
      </Popover>
    </HStack>
  );
}

interface SearchInputProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
}

function SearchInput({
  searchValue,
  onSearchChange,
  viewMode,
}: SearchInputProps) {
  const t = useTranslations('ADE/ToolRules');

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange],
  );

  const SEARCH_PLACEHOLDERS: Record<ViewMode, string> = {
    rules: t('ToolRuleList.search'),
    tools: t('searchTools'),
  };

  const placeholder = SEARCH_PLACEHOLDERS[viewMode];

  return (
    <HStack fullWidth border align="center">
      <RawInput
        hideLabel
        size="small"
        fullWidth
        color="transparent"
        placeholder={placeholder}
        preIcon={<SearchIcon />}
        label={placeholder}
        value={searchValue}
        onChange={handleSearchChange}
      />
    </HStack>
  );
}

// Main Component
export function ToolRulesSearchFilter({
  searchValue,
  onSearchChange,
  onAddRule,
  filterBy,
  onFilterChange,
  viewMode,
  onViewModeChange,
}: ToolRulesSearchFilterProps) {
  const t = useTranslations('ADE/ToolRules');

  const handleViewModeChange = useCallback(
    (value: ViewMode) => {
      onViewModeChange(value);
    },
    [onViewModeChange],
  );

  const getViewModeItems = useCallback(() => {
    return [
      { value: 'rules' as const, label: t('viewMode.byRules') },
      { value: 'tools' as const, label: t('viewMode.byTools') },
    ];
  }, [t]);

  return (
    <VStack gap="large" fullWidth justify="start" paddingTop="small">
      <HStack
        fullWidth
        justify="spaceBetween"
        align="center"
        paddingX="xxsmall"
        /* eslint-disable-next-line react/forbid-component-props */
        style={{ minHeight: '28px' }}
      >
        <Typography variant="heading5" bold>
          {t('title')}
        </Typography>
        <HStack>
          {onAddRule && <NewToolRuleButton onSelect={onAddRule} />}
        </HStack>
      </HStack>

      <HStack fullWidth paddingX="xxsmall">
        {/* eslint-disable-next-line react/forbid-component-props */}
        <HStack style={{ minWidth: '150px' }} border>
          <RawToggleGroup
            size="small"
            fullWidth
            value={viewMode}
            onValueChange={handleViewModeChange}
            hideLabel
            label="View mode"
            items={getViewModeItems()}
          />
        </HStack>

        {viewMode === 'rules' && (
          <FilterDropdown filterBy={filterBy} onFilterChange={onFilterChange} />
        )}

        <SearchInput
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          viewMode={viewMode}
        />
      </HStack>
    </VStack>
  );
}
