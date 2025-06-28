'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  ArrowRightIcon,
  Badge,
  Button,
  Checkbox,
  ChildNodesIcon,
  ConditionalIcon,
  Dialog,
  DropdownDetailedMenuItem,
  DropdownMenu,
  EndIcon,
  FormField,
  HStack,
  isMultiValue,
  KeyValueEditor,
  PlusIcon,
  RawInput,
  RefreshIcon,
  RuleIcon,
  SearchIcon,
  Select,
  StartIcon,
  toast,
  TrashIcon,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import {
  type MaxCountPerStepToolRule,
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  type AgentState,
  type ContinueToolRule,
  type ChildToolRule,
  type ConditionalToolRule,
  type InitToolRule,
  type TerminalToolRule,
  type RequiredBeforeExitToolRule,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useFormContext } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { deepEquals } from 'nx/src/utils/json-diff';
import type {
  SupportedToolRuleTypes,
  SupportedToolRuleNameTypes,
  ToolRules,
} from './types';
// import { useMergedToolData } from './hooks/useMergedToolData';

// Hooks
function useToolTitleFromType(type: SupportedToolRuleNameTypes) {
  const t = useTranslations('ADE/ToolRules');

  return useMemo(() => {
    switch (type) {
      case 'constrain_child_tools':
        return t('toolTypes.constrainChildTools.title');
      case 'run_first':
        return t('toolTypes.runFirst.title');
      case 'exit_loop':
        return t('toolTypes.exitLoop.title');
      case 'conditional':
        return t('toolTypes.conditional.title');
      case 'continue_loop':
        return t('toolTypes.continueLoop.title');
      case 'max_count_per_step':
        return t('toolTypes.maxCountPerStep.title');
      case 'required_before_exit':
        return t('toolTypes.requiredBeforeExit.title');
    }

    return '';
  }, [t, type]);
}

function useToolIconsFromType(type: SupportedToolRuleNameTypes) {
  return useMemo(() => {
    switch (type) {
      case 'constrain_child_tools':
        return <ChildNodesIcon />;
      case 'run_first':
        return <StartIcon />;
      case 'exit_loop':
        return <EndIcon />;
      case 'conditional':
        return <ConditionalIcon />;
      case 'continue_loop':
        return <ArrowRightIcon />;
      case 'max_count_per_step':
        return <RuleIcon />;
      case 'required_before_exit':
        return <EndIcon />;
    }

    return null;
  }, [type]);
}

// Wrapper Component
interface ToolRuleItemWrapperProps {
  isValid: boolean;
  isDirty: boolean;
  type: SupportedToolRuleNameTypes;
  onRemove: () => void;
  children: React.ReactNode;
}

function ToolRuleItemWrapper(props: ToolRuleItemWrapperProps) {
  const { isValid, isDirty, children, onRemove, type } = props;

  const form = useFormContext();
  const onReset = useCallback(() => {
    form.reset();
  }, [form]);

  const title = useToolTitleFromType(type);
  const icon = useToolIconsFromType(type);
  const t = useTranslations('ADE/ToolRules');

  return (
    <VStack gap={false} border color="background">
      <HStack
        borderBottom
        padding="small"
        align="center"
        justify="spaceBetween"
      >
        <HStack gap="small" align="center">
          {icon}
          <Typography variant="body2" bold>
            {title}
          </Typography>
        </HStack>
        <HStack align="center">
          {!isValid && (
            <Badge
              content={t('ToolRuleItemWrapper.invalid')}
              preIcon={<WarningIcon />}
              variant="destructive"
            />
          )}
          {isDirty && (
            <Badge
              content={t('ToolRuleItemWrapper.dirty')}
              preIcon={<WarningIcon />}
              variant="warning"
            />
          )}
          {isDirty && (
            <Button
              color="secondary"
              size="small"
              onClick={onReset}
              preIcon={<RefreshIcon />}
              hideLabel
            />
          )}
          <Dialog
            title={t('ToolRuleItemWrapper.confirmRemove.title')}
            onConfirm={onRemove}
            trigger={
              <Button
                preIcon={<TrashIcon />}
                color="secondary"
                size="small"
                hideLabel
                _use_rarely_disableTooltip
              />
            }
          >
            {t('ToolRuleItemWrapper.confirmRemove.description')}
          </Dialog>
          <Button
            disabled={!isValid || !isDirty}
            type="submit"
            color="primary"
            size="small"
            label={t('ToolRuleItemWrapper.save')}
          />
        </HStack>
      </HStack>
      <VStack padding="small">{children}</VStack>
    </VStack>
  );
}

// Editor Components
interface ToolEditorDefaultProps {
  onSubmit: (data: SupportedToolRuleTypes | SupportedToolRuleTypes[]) => void;
  onRemove: () => void;
}

// Start Constraint Tool Editor
interface StartConstraintToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: InitToolRule;
}

const startConstraintToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('run_first'),
});

type StartConstraintToolRule = z.infer<typeof startConstraintToolRuleSchema>;

function StartConstraintToolEditor(props: StartConstraintToolEditorProps) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<StartConstraintToolRule>({
    resolver: zodResolver(startConstraintToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'run_first',
    },
  });

  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: StartConstraintToolRule) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'run_first',
      });
      form.reset({
        toolName: data.toolName,
        type: 'run_first',
      });
    },
    [form, onSubmit],
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ToolRuleItemWrapper
          isValid={form.formState.isValid}
          isDirty={form.formState.isDirty}
          type="run_first"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('StartConstraintToolEditor.sentence', {
                  tool: () => (
                    <Select
                      label={t('StartConstraintToolEditor.toolName')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('StartConstraintToolEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Child Tool Rule Editor
interface ChildToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ChildToolRule;
}

const childToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('constrain_child_tools'),
  children: z.array(z.string()),
});

type ChildToolRuleType = z.infer<typeof childToolRuleSchema>;

function ChildToolRuleEditor(props: ChildToolRuleEditorProps) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<ChildToolRuleType>({
    resolver: zodResolver(childToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'constrain_child_tools',
      children: defaultRule.children,
    },
  });

  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ChildToolRuleType) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'constrain_child_tools',
        children: data.children,
      });
      form.reset({
        toolName: data.toolName,
        type: 'constrain_child_tools',
        children: data.children,
      });
    },
    [form, onSubmit],
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ToolRuleItemWrapper
          isValid={form.formState.isValid}
          isDirty={form.formState.isDirty}
          type="constrain_child_tools"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ChildToolRuleEditor.sentence', {
                  tool: () => (
                    <Select
                      label={t('ChildToolRuleEditor.toolName')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('ChildToolRuleEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
          <FormField
            name="children"
            render={({ field }) => (
              <HStack fullWidth align="center">
                <Select
                  fullWidth
                  label={t('ChildToolRuleEditor.children')}
                  value={(field.value as ChildToolRuleType['children']).map(
                    (value) => ({
                      value,
                      label: value,
                    }),
                  )}
                  isMulti
                  inline
                  hideLabel
                  placeholder={t('ChildToolRuleEditor.children')}
                  options={(tools || []).map((tool) => ({
                    value: tool.name || '',
                    label: tool.name || '',
                  }))}
                  onSelect={(value) => {
                    if (isMultiValue(value)) {
                      field.onChange(value.map((v) => v.value));
                      return;
                    }
                    return;
                  }}
                />
              </HStack>
            )}
          />
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Conditional Tool Editor
interface ConditionalToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: ConditionalToolRule;
}

const conditionalToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('conditional'),
  defaultChild: z.string(),
  requireOutputMapping: z.boolean(),
  childOutputMapping: z.record(z.string()),
});

type ConditionalToolRuleFormType = z.infer<typeof conditionalToolRuleSchema>;

function ConditionalToolEditor(props: ConditionalToolEditorProps) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<ConditionalToolRuleFormType>({
    resolver: zodResolver(conditionalToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'conditional',
      defaultChild: defaultRule.default_child || '',
      requireOutputMapping: defaultRule.require_output_mapping,
      childOutputMapping: defaultRule.child_output_mapping,
    },
  });

  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ConditionalToolRuleFormType) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'conditional',
        default_child: data.defaultChild,
        require_output_mapping: data.requireOutputMapping,
        child_output_mapping: data.childOutputMapping,
      });
      form.reset({
        toolName: data.toolName,
        type: 'conditional',
        defaultChild: data.defaultChild,
        requireOutputMapping: data.requireOutputMapping,
        childOutputMapping: data.childOutputMapping,
      });
    },
    [form, onSubmit],
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ToolRuleItemWrapper
          isValid={form.formState.isValid}
          isDirty={form.formState.isDirty}
          type="conditional"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ConditionalToolEditor.sentence1', {
                  tool: () => (
                    <Select
                      label={t('ConditionalToolEditor.toolName')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('ConditionalToolEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
          <FormField
            name="childOutputMapping"
            render={({ field }) => (
              <VStack fullWidth>
                <KeyValueEditor
                  hideLabel
                  label={t('ConditionalToolEditor.childOutputMapping')}
                  value={Object.entries(field.value).map(([key, value]) => ({
                    key,
                    value: value as string,
                  }))}
                  onValueChange={(value) => {
                    field.onChange(
                      value.reduce(
                        (acc, { key, value }) => {
                          acc[key] = value;
                          return acc;
                        },
                        {} as Record<string, string>,
                      ),
                    );
                  }}
                />
              </VStack>
            )}
          />
          <FormField
            name="defaultChild"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ConditionalToolEditor.sentence2', {
                  tool: () => (
                    <Select
                      label={t('ConditionalToolEditor.defaultChild')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('ConditionalToolEditor.defaultChild')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
          <FormField
            name="requireOutputMapping"
            render={({ field }) => (
              <HStack align="center">
                <Checkbox
                  label={t('ConditionalToolEditor.requireOutputMapping')}
                  onCheckedChange={field.onChange}
                  checked={field.value}
                />
              </HStack>
            )}
          />
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Continue Tool Rule Editor
interface ContinueToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ContinueToolRule;
  allContinueLoopRules?: ContinueToolRule[];
}

const continueLoopToolRuleSchema = z.object({
  toolNames: z.array(z.string()),
  type: z.literal('continue_loop'),
});

type ContinueToolRuleFormData = z.infer<typeof continueLoopToolRuleSchema>;

function ContinueToolRuleComponent(props: ContinueToolRuleEditorProps) {
  const { defaultRule: _defaultRule, onRemove, onSubmit, allContinueLoopRules = [] } = props;

  // Get all tool names that are currently in continue_loop rules
  const currentToolNames = allContinueLoopRules.map(rule => rule.tool_name);

  const form = useForm<ContinueToolRuleFormData>({
    resolver: zodResolver(continueLoopToolRuleSchema),
    defaultValues: {
      toolNames: currentToolNames.filter(name => name !== ''), // Only include non-empty tool names
      type: 'continue_loop',
    },
  });
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ContinueToolRuleFormData) => {
      // Create multiple rules, one for each selected tool
      // If no tools selected, create a single empty rule
      const rules = data.toolNames.length > 0 
        ? data.toolNames.map(toolName => ({
            tool_name: toolName,
            type: 'continue_loop' as const,
          }))
        : [{ tool_name: '', type: 'continue_loop' as const }];
      
      // Submit all rules at once
      onSubmit(rules);
      form.reset({
        toolNames: data.toolNames,
        type: 'continue_loop',
      });
    },
    [form, onSubmit],
  );

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ToolRuleItemWrapper
            isValid={form.formState.isValid}
            isDirty={form.formState.isDirty}
            type="continue_loop"
            onRemove={onRemove}
          >
          <FormField
            name="toolNames"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ContinueToolRule.sentence', {
                  tool: () => (
                    <Select
                      label={t('ContinueToolRule.toolName')}
                      value={(field.value as string[]).map(toolName => ({
                        value: toolName,
                        label: toolName,
                      }))}
                      isMulti
                      inline
                      hideLabel
                      placeholder={t('ContinueToolRule.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          field.onChange(value.map(v => v.value));
                          return;
                        }
                        return;
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
          </ToolRuleItemWrapper>
        </form>
      </FormProvider>
    </>
  );
}

// Exit Loop Tool Editor
interface ExitLoopToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: TerminalToolRule;
  allExitLoopRules?: TerminalToolRule[];
}

const exitLoopToolRuleSchema = z.object({
  toolNames: z.array(z.string()),
  type: z.literal('exit_loop'),
});

type ExitLoopToolRuleFormData = z.infer<typeof exitLoopToolRuleSchema>;

function ExitLoopToolEditor(props: ExitLoopToolEditorProps) {
  const { defaultRule: _defaultRule, onRemove, onSubmit, allExitLoopRules = [] } = props;

  // Get all tool names that are currently in exit_loop rules
  const currentToolNames = allExitLoopRules.map(rule => rule.tool_name);

  const form = useForm<ExitLoopToolRuleFormData>({
    resolver: zodResolver(exitLoopToolRuleSchema),
    defaultValues: {
      toolNames: currentToolNames.filter(name => name !== ''), // Only include non-empty tool names
      type: 'exit_loop',
    },
  });
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ExitLoopToolRuleFormData) => {
      // Create multiple rules, one for each selected tool
      // If no tools selected, create a single empty rule
      const rules = data.toolNames.length > 0 
        ? data.toolNames.map(toolName => ({
            tool_name: toolName,
            type: 'exit_loop' as const,
          }))
        : [{ tool_name: '', type: 'exit_loop' as const }];
      
      // Submit all rules at once
      onSubmit(rules);
      form.reset({
        toolNames: data.toolNames,
        type: 'exit_loop',
      });
    },
    [form, onSubmit],
  );

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ToolRuleItemWrapper
            isValid={form.formState.isValid}
            isDirty={form.formState.isDirty}
            type="exit_loop"
            onRemove={onRemove}
          >
          <FormField
            name="toolNames"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ExitLoopToolEditor.sentence', {
                  tool: () => (
                    <Select
                      label={t('ExitLoopToolEditor.toolName')}
                      value={(field.value as string[]).map(toolName => ({
                        value: toolName,
                        label: toolName,
                      }))}
                      isMulti
                      inline
                      hideLabel
                      placeholder={t('ExitLoopToolEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          field.onChange(value.map(v => v.value));
                          return;
                        }
                        return;
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
          </ToolRuleItemWrapper>
        </form>
      </FormProvider>
    </>
  );
}

// Max Count Per Step Tool Rule Editor
interface MaxCountPerStepToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: MaxCountPerStepToolRule;
}

const maxCountPerStepToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('max_count_per_step'),
  maxCount: z.string().refine((value) => {
    return !isNaN(Number(value));
  }),
});

type MaxCountPerStepToolRuleType = z.infer<
  typeof maxCountPerStepToolRuleSchema
>;

function MaxCountPerStepToolRuleEditor(
  props: MaxCountPerStepToolRuleEditorProps,
) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<MaxCountPerStepToolRuleType>({
    resolver: zodResolver(maxCountPerStepToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'max_count_per_step',
      maxCount: defaultRule.max_count_limit.toString(),
    },
  });

  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: MaxCountPerStepToolRuleType) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'max_count_per_step',
        max_count_limit: parseInt(data.maxCount, 10),
      });
      form.reset({
        toolName: data.toolName,
        type: 'max_count_per_step',
        maxCount: data.maxCount,
      });
    },
    [form, onSubmit],
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ToolRuleItemWrapper
          isValid={form.formState.isValid}
          isDirty={form.formState.isDirty}
          type="max_count_per_step"
          onRemove={onRemove}
        >
          <HStack align="center">
            {t.rich('MaxCountPerStepToolRuleEditor.sentence', {
              tool: () => (
                <FormField
                  name="toolName"
                  render={({ field }) => (
                    <Select
                      label={t('MaxCountPerStepToolRuleEditor.toolName')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('MaxCountPerStepToolRuleEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  )}
                />
              ),
              count: () => (
                <FormField
                  name="maxCount"
                  render={({ field }) => (
                    <RawInput
                      hideLabel
                      label={t('MaxCountPerStepToolRuleEditor.count')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              ),
            })}
          </HStack>
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Add the schema for RequiredBeforeExitToolRule
const requiredBeforeExitToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('required_before_exit'),
});

type RequiredBeforeExitToolRuleType = z.infer<
  typeof requiredBeforeExitToolRuleSchema
>;

// Add the editor interface
interface RequiredBeforeExitToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: RequiredBeforeExitToolRule;
}

// Add the editor component
function RequiredBeforeExitToolEditor(
  props: RequiredBeforeExitToolEditorProps,
) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<RequiredBeforeExitToolRuleType>({
    resolver: zodResolver(requiredBeforeExitToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'required_before_exit',
    },
  });

  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: RequiredBeforeExitToolRuleType) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'required_before_exit',
      });
      form.reset({
        toolName: data.toolName,
        type: 'required_before_exit',
      });
    },
    [form, onSubmit],
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ToolRuleItemWrapper
          isValid={form.formState.isValid}
          isDirty={form.formState.isDirty}
          type="required_before_exit"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('RequiredBeforeExitToolEditor.sentence', {
                  tool: () => (
                    <Select
                      label={t('RequiredBeforeExitToolEditor.toolName')}
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label: field.value,
                            }
                          : undefined
                      }
                      inline
                      hideLabel
                      placeholder={t('RequiredBeforeExitToolEditor.toolName')}
                      options={(tools || []).map((tool) => ({
                        value: tool.name || '',
                        label: tool.name || '',
                      }))}
                      onSelect={(value) => {
                        if (isMultiValue(value)) {
                          return;
                        }
                        field.onChange(value?.value);
                      }}
                    />
                  ),
                })}
              </HStack>
            )}
          />
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// New Rule Button Components
interface NewRuleButtonProps {
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function NewRuleButton(props: NewRuleButtonProps) {
  const { onSelect, title, description, icon } = props;
  return (
    <DropdownDetailedMenuItem
      description={description}
      label={title}
      preIcon={icon}
      onClick={() => {
        onSelect();
      }}
    />
  );
}

interface NewToolRuleButtonProps {
  onSelect: (rule: SupportedToolRuleNameTypes) => void;
}

function NewToolRuleButton(props: NewToolRuleButtonProps) {
  const { onSelect } = props;
  const t = useTranslations('ADE/ToolRules');
  return (
    <DropdownMenu
      triggerAsChild
      align="end"
      trigger={
        <Button
          size="small"
          preIcon={<PlusIcon />}
          label={t('ToolRuleList.newRule')}
          color="secondary"
        />
      }
    >
      <NewRuleButton
        onSelect={() => {
          onSelect('run_first');
        }}
        title={t('toolTypes.runFirst.title')}
        description={t('toolTypes.runFirst.description')}
        icon={<StartIcon />}
      />
      <NewRuleButton
        onSelect={() => {
          onSelect('exit_loop');
        }}
        title={t('toolTypes.exitLoop.title')}
        description={t('toolTypes.exitLoop.description')}
        icon={<EndIcon />}
      />
      <NewRuleButton
        onSelect={() => {
          onSelect('required_before_exit');
        }}
        title={t('toolTypes.requiredBeforeExit.title')}
        description={t('toolTypes.requiredBeforeExit.description')}
        icon={<EndIcon />}
      />
      <NewRuleButton
        onSelect={() => {
          onSelect('constrain_child_tools');
        }}
        title={t('toolTypes.constrainChildTools.title')}
        description={t('toolTypes.constrainChildTools.description')}
        icon={<ChildNodesIcon />}
      />
      <NewRuleButton
        onSelect={() => {
          onSelect('continue_loop');
        }}
        title={t('toolTypes.continueLoop.title')}
        description={t('toolTypes.continueLoop.description')}
        icon={<ArrowRightIcon />}
      />
      <NewRuleButton
        onSelect={() => {
          onSelect('max_count_per_step');
        }}
        title={t('toolTypes.maxCountPerStep.title')}
        description={t('toolTypes.maxCountPerStep.description')}
        icon={<RuleIcon />}
      />
    </DropdownMenu>
  );
}

// Main ToolRulesList Component
interface ToolRulesListProps {
  defaultToolRules: ToolRules;
}

export function ToolRulesList(props: ToolRulesListProps) {
  const { defaultToolRules } = props;
  const [search, setSearch] = React.useState('');
  const currentAgent = useCurrentAgent();
  const { id: agentId } = currentAgent;
  const t = useTranslations('ADE/ToolRules');
  const [toolRules, setToolRules] = useState(() => {
    return Array.isArray(defaultToolRules) ? defaultToolRules : [];
  });

  const queryClient = useQueryClient();

  const { mutate } = useAgentsServiceModifyAgent({
    onError: () => {
      toast.error(t('ToolRuleList.error'));
      setToolRules(Array.isArray(defaultToolRules) ? defaultToolRules : []);
    },
    onSuccess: (data) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            tool_rules: data.tool_rules,
          };
        },
      );
    },
  });

  const handleUpdateTools = useCallback(
    (nextTools: ToolRules) => {
      mutate({
        agentId,
        requestBody: {
          tool_rules: nextTools,
        },
      });
    },
    [agentId, mutate],
  );

  const filteredRules = useMemo(() => {
    // Filter out unsupported rule types first
    const supportedRules = toolRules.filter((rule): rule is SupportedToolRuleTypes => {
      return !!rule.type && [
        'continue_loop', 'exit_loop', 'run_first', 'constrain_child_tools',
        'conditional', 'max_count_per_step', 'required_before_exit'
      ].includes(rule.type);
    });
    
    // Group rules by type for continue_loop and exit_loop
    const grouped = supportedRules.reduce((acc, rule, index) => {
      if (rule.type === 'continue_loop' || rule.type === 'exit_loop') {
        // For these types, always show as grouped - only keep the first occurrence in the UI
        if (!acc.find(item => item.rule.type === rule.type)) {
          acc.push({ rule, index, isGrouped: true });
        }
      } else {
        // For other types, keep all rules
        acc.push({ rule, index, isGrouped: false });
      }
      
      return acc;
    }, [] as Array<{ rule: SupportedToolRuleTypes; index: number; isGrouped: boolean }>);
    
    // Filter based on search (skip search filter for empty tool names to allow new rules to show)
    return grouped.filter(({ rule }) => {
      if (rule.tool_name === '') return true; // Always show new empty rules
      return rule.tool_name.toLowerCase().includes(search.toLowerCase());
    });
  }, [search, toolRules]);

  const handleSelectRule = useCallback((rule: SupportedToolRuleNameTypes) => {
    setToolRules((prev) => {
      if (rule === 'constrain_child_tools') {
        return [...prev, { type: rule, tool_name: '', children: [] }];
      }

      if (
        rule === 'run_first' ||
        rule === 'exit_loop' ||
        rule === 'continue_loop' ||
        rule === 'required_before_exit'
      ) {
        return [...prev, { type: rule, tool_name: '' }];
      }

      if (rule === 'conditional') {
        return [
          ...prev,
          {
            type: rule,
            tool_name: '',
            default_child: '',
            require_output_mapping: false,
            child_output_mapping: {},
          },
        ];
      }

      if (rule === 'max_count_per_step') {
        return [
          ...prev,
          {
            type: rule,
            tool_name: '',
            max_count_limit: 1,
          },
        ];
      }

      throw new Error('Unsupported rule type');
    });
  }, []);

  const mounted = React.useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    if (deepEquals(toolRules, defaultToolRules)) {
      return;
    }

    handleUpdateTools(toolRules);
  }, [toolRules, defaultToolRules, handleUpdateTools]);

  const handleRemoveRule = useCallback((index: number) => {
    setToolRules((prev) => {
      const ruleToRemove = prev[index];
      
      // For continue_loop and exit_loop, remove all rules of the same type
      if (ruleToRemove.type === 'continue_loop' || ruleToRemove.type === 'exit_loop') {
        return prev.filter(rule => rule.type !== ruleToRemove.type);
      }
      
      // For other rule types, remove just the single rule
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSaveRule = useCallback(
    (index: number, rule: SupportedToolRuleTypes | SupportedToolRuleTypes[]) => {
      setToolRules((prev) => {
        if (Array.isArray(rule)) {
          // Handle multiple rules (for continue_loop and exit_loop)
          const currentRule = prev[index];
          const ruleType = currentRule.type;
          
          // Find the position of the first rule of this type to maintain order
          const firstRuleIndex = prev.findIndex(r => r.type === ruleType);
          
          // Create new array maintaining order
          const newRules = [...prev];
          
          // Remove all existing rules of the same type
          for (let i = newRules.length - 1; i >= 0; i--) {
            if (newRules[i].type === ruleType) {
              newRules.splice(i, 1);
            }
          }
          
          // Insert new rules at the original position of the first rule
          const insertPosition = firstRuleIndex >= 0 ? Math.min(firstRuleIndex, newRules.length) : newRules.length;
          newRules.splice(insertPosition, 0, ...rule);
          
          return newRules;
        } else {
          // Handle single rule (existing behavior)
          return prev.map((item, i) => {
            if (i === index) {
              return rule;
            }
            return item;
          });
        }
      });
    },
    [],
  );

  return (
    <VStack
      gap={false}
      fullHeight
      overflowY="hidden"
      fullWidth
      color="background-grey"
    >
      <HStack
        align="center"
        paddingX="medium"
        borderBottom
        height="header-sm"
        fullWidth
        color="background"
      >
        <RawInput
          hideLabel
          className="border-none"
          size="small"
          fullWidth
          placeholder={t('ToolRuleList.search')}
          preIcon={<SearchIcon />}
          label={t('ToolRuleList.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <NewToolRuleButton onSelect={handleSelectRule} />
      </HStack>
      <VStack padding collapseHeight flex overflowY="auto">
        <VStack>
          {filteredRules.map(({ rule, index }) => {
            if (rule.type === 'exit_loop') {
              const allExitLoopRules = toolRules.filter(r => r.type === 'exit_loop') as TerminalToolRule[];
              return (
                <ExitLoopToolEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={`exit_loop_group`}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                  allExitLoopRules={allExitLoopRules}
                />
              );
            }

            if (rule.type === 'required_before_exit') {
              return (
                <RequiredBeforeExitToolEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={index}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                />
              );
            }

            if (rule.type === 'constrain_child_tools') {
              return (
                <ChildToolRuleEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={index}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                />
              );
            }

            if (rule.type === 'conditional') {
              return (
                <ConditionalToolEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={index}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                />
              );
            }

            if (rule.type === 'run_first') {
              return (
                <StartConstraintToolEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={index}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                />
              );
            }

            if (rule.type === 'continue_loop') {
              const allContinueLoopRules = toolRules.filter(r => r.type === 'continue_loop') as ContinueToolRule[];
              return (
                <ContinueToolRuleComponent
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={`continue_loop_group`}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                  allContinueLoopRules={allContinueLoopRules}
                />
              );
            }

            if (rule.type === 'max_count_per_step') {
              return (
                <MaxCountPerStepToolRuleEditor
                  onRemove={() => {
                    handleRemoveRule(index);
                  }}
                  key={index}
                  onSubmit={(data) => {
                    handleSaveRule(index, data);
                  }}
                  defaultRule={rule}
                />
              );
            }

            return null;
          })}
        </VStack>
      </VStack>
    </VStack>
  );
}
