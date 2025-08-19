'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../Typography/Typography';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo, useState } from 'react';
import { Button } from '../Button/Button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LockClosedIcon,
  SubdirectoryArrowRightIcon,
  TrashIcon,
} from '../../icons';
import { Badge } from '../Badge/Badge';
import { RawInput } from '../Input/Input';
import { Tooltip } from '../Tooltip/Tooltip';

interface VariablePartInputProps {
  label: string;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

function VariablePart(props: VariablePartInputProps) {
  const { label, value, disabled, onValueChange } = props;

  return (
    <HStack
      as="label"
      className="h-[36px]"
      align="center"
      paddingX={!disabled ? 'medium' : 'small'}
      fullWidth
      gap="medium"
      color={disabled ? 'background-grey' : 'background'}
      border={!disabled}
    >
      <div className="mt-[-2px]">
        <Typography color="muted" bold uppercase variant="body4">
          {label}
        </Typography>
      </div>
      <input
        value={value}
        className="w-full h-full text-base bg-transparent outline-none"
        placeholder={label}
        onChange={(e) => {
          onValueChange(e.target.value);
        }}
        disabled={disabled}
      />
    </HStack>
  );
}

function useVariableScopeTranslationMap() {
  const t = useTranslations('components/VariableInput');
  return useMemo(() => {
    return {
      agent: t('scopes.agent.label'),
      global: t('scopes.global.label'),
      simulator: t('scopes.simulator.label'),
    };
  }, [t]);
}

function useVariableScopeTooltipTranslationMap() {
  const t = useTranslations('components/VariableInput');
  return useMemo(() => {
    return {
      agent: t('scopes.agent.tooltip'),
      global: t('scopes.global.tooltip'),
      simulator: t('scopes.simulator.tooltip'),
    };
  }, [t]);
}

interface VariableScopeBadgeProps {
  scope: VariableScope;
}

export function ScopeBadge(props: VariableScopeBadgeProps) {
  const { scope } = props;
  const scopeTranslationMap = useVariableScopeTranslationMap();
  const tooltipTranslationMap = useVariableScopeTooltipTranslationMap();

  return (
    <Tooltip content={tooltipTranslationMap[scope]}>
      <Badge content={scopeTranslationMap[scope]} variant="default" border />
    </Tooltip>
  );
}

interface InlineInputProps {
  value: string;
  scope: VariableScope;
  onValueChange?: (value: string) => void;
  showArrow?: boolean;
}

function InlineInput(props: InlineInputProps) {
  const { value, scope, showArrow, onValueChange } = props;
  const t = useTranslations('components/VariableInput');

  const scopeTranslationMap = useVariableScopeTranslationMap();

  return (
    <HStack fullWidth>
      <div className="w-[36px] items-center flex justify-center">
        {showArrow && <SubdirectoryArrowRightIcon color="muted" />}
      </div>

      <HStack
        as="label"
        className="h-[36px]"
        align="center"
        paddingX="medium"
        fullWidth
        gap="medium"
      >
        <Badge
          border
          content={t('valueInput', { scope: scopeTranslationMap[scope] })}
          variant="default"
        />
        <RawInput
          label={t('valueInput', { scope: scopeTranslationMap[scope] })}
          hideLabel
          value={value}
          fullWidth
          postIcon={!onValueChange && <LockClosedIcon />}
          placeholder={t('InlineInput.placeholder')}
          disabled={!onValueChange}
          onChange={(e) => {
            if (onValueChange) {
              onValueChange(e.target.value);
            }
          }}
        />
      </HStack>
    </HStack>
  );
}

interface OverridesViewerProps {
  editableValue: VariableDefinition;
  overriddenValues: OverriddenVariableDefinition[];
  onValueChange: (value: VariableDefinition) => void;
}

function OverridesViewer(props: OverridesViewerProps) {
  const { editableValue, onValueChange, overriddenValues } = props;

  return (
    <VStack>
      {overriddenValues.map((value, index) => {
        return (
          <InlineInput
            key={index}
            showArrow={index === 0}
            value={value.value}
            scope={value.scope}
          />
        );
      })}
      <InlineInput
        value={editableValue.value}
        scope={editableValue.scope}
        onValueChange={(value) => {
          onValueChange({ ...editableValue, value });
        }}
      />
    </VStack>
  );
}

export type VariableScope = 'agent' | 'global' | 'simulator';

export interface VariableDefinition {
  key: string;
  value: string;
  scope: VariableScope;
}

interface OverriddenVariableDefinition {
  value: string;
  scope: VariableScope;
}

interface VariableInputProps {
  value: VariableDefinition;
  onValueChange: (value: VariableDefinition) => void;
  overriddenValues?: OverriddenVariableDefinition[];
  canDelete?: boolean;
  onDelete?: () => void;
}

export function VariableInput(props: VariableInputProps) {
  const {
    value,
    onValueChange,
    canDelete,
    onDelete,
    overriddenValues = [],
  } = props;
  const t = useTranslations('components/VariableInput');
  const [expanded, setExpanded] = useState(false);

  const scopeTranslationMap = useVariableScopeTranslationMap();

  const hasOverriddenValues = useMemo(() => {
    return overriddenValues.length > 0;
  }, [overriddenValues]);

  return (
    <VStack fullWidth>
      <HStack align="center">
        {hasOverriddenValues && (
          <Button
            hideLabel
            size="small"
            preIcon={expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            color="secondary"
            label={expanded ? t('hide') : t('show')}
            onClick={() => {
              setExpanded(!expanded);
            }}
          />
        )}
        <div className="w-[40%]">
          <VariablePart
            value={value.key}
            label={t('key')}
            disabled={hasOverriddenValues}
            onValueChange={(key) => {
              onValueChange({ ...value, key });
            }}
          />
        </div>
        <VariablePart
          value={value.value}
          disabled={hasOverriddenValues}
          label={t('value')}
          onValueChange={(val) => {
            onValueChange({ ...value, value: val });
          }}
        />
        {canDelete && (
          <Button
            label={t('delete')}
            hideLabel
            onClick={onDelete}
            color="tertiary"
            preIcon={<TrashIcon />}
          />
        )}
        <Badge
          content={scopeTranslationMap[value.scope]}
          variant="default"
          border
        />
      </HStack>
      {expanded && (
        <OverridesViewer
          onValueChange={onValueChange}
          editableValue={value}
          overriddenValues={overriddenValues}
        />
      )}
    </VStack>
  );
}
