'use client';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  Button,
  Checkbox,
  ConditionalIcon,
  ConstrainChildToolsIcon,
  ContinueLoopIcon,
  Dialog,
  EndIcon,
  FormField,
  HStack,
  Input,
  isMultiValue,
  KeyValueEditor,
  MaxCountPerStepIcon,
  RefreshIcon,
  Select,
  StartIcon,
  TrashIcon,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../../hooks';
import type {
  MaxCountPerStepToolRule,
  ContinueToolRule,
  ChildToolRule,
  ConditionalToolRule,
  InitToolRule,
  TerminalToolRule,
  RequiresApprovalToolRule,
  RequiredBeforeExitToolRule,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useFormContext } from 'react-hook-form';
import type {
  SupportedToolRuleTypes,
  SupportedToolRuleNameTypes,
  ToolEditorDefaultProps,
} from './types';

// Hooks
export function useToolTitleFromType(type: SupportedToolRuleNameTypes) {
  const t = useTranslations('ADE/ToolRules');

  return useMemo(() => {
    switch (type) {
      case 'requires_approval':
        return t('toolTypes.requiresApproval.title');
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

export function useToolIconsFromType(type: SupportedToolRuleNameTypes) {
  return useMemo(() => {
    switch (type) {
      case 'constrain_child_tools':
        return <ConstrainChildToolsIcon size="small" color="default" />;
      case 'run_first':
        return <StartIcon size="small" color="default" />;
      case 'exit_loop':
        return <EndIcon size="small" color="default" />;
      case 'conditional':
        return <ConditionalIcon size="small" color="default" />;
      case 'continue_loop':
        return <ContinueLoopIcon size="small" color="default" />;
      case 'max_count_per_step':
        return <MaxCountPerStepIcon size="small" color="default" />;
      case 'required_before_exit':
        return <EndIcon size="small" color="default" />;
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

export function ToolRuleItemWrapper(props: ToolRuleItemWrapperProps) {
  const { isValid, isDirty, children, onRemove, type } = props;

  const form = useFormContext();

  const onReset = useCallback(() => {
    form.reset();
  }, [form]);

  const title = useToolTitleFromType(type);
  const icon = useToolIconsFromType(type);
  const t = useTranslations('ADE/ToolRules');

  return (
    <div className="tool-rule-item-hover">
      <VStack gap={false} border color="background" className="h-full">
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
          </HStack>
          <HStack align="center" gap="small">
            {isDirty && (
              <Button
                color="secondary"
                size="small"
                onClick={onReset}
                preIcon={<RefreshIcon />}
                hideLabel
                _use_rarely_disableTooltip
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
                  _use_rarely_className={
                    isDirty ? 'visible' : 'tool-rule-trash-hidden'
                  }
                />
              }
            >
              {t('ToolRuleItemWrapper.confirmRemove.description')}
            </Dialog>
            {isValid && isDirty && (
              <Button
                type="submit"
                color="primary"
                size="small"
                label={t('ToolRuleItemWrapper.save')}
              />
            )}
          </HStack>
        </HStack>
        <VStack padding="small">{children}</VStack>
      </VStack>
    </div>
  );
}

// Start Constraint Tool Editor
interface StartConstraintToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: InitToolRule;
  viewMode: 'rules' | 'tools';
}

const startConstraintToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('run_first'),
});

type StartConstraintToolRule = z.infer<typeof startConstraintToolRuleSchema>;

export function StartConstraintToolEditor(
  props: StartConstraintToolEditorProps,
) {
  const { defaultRule, onRemove, onSubmit, viewMode } = props;

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
          {viewMode === 'rules' ? (
            // Full form with tool selection in rules view
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
          ) : (
            // Just the description in tools view
            <HStack align="center">
              <Typography variant="body2" color="default">
                {t('StartConstraintToolEditor.description')}
              </Typography>
            </HStack>
          )}
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Child Tool Rule Editor
interface ChildToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ChildToolRule;
  viewMode: 'rules' | 'tools';
}

const childToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('constrain_child_tools'),
  children: z.array(z.string()),
});

type ChildToolRuleType = z.infer<typeof childToolRuleSchema>;

export function ChildToolRuleEditor(props: ChildToolRuleEditorProps) {
  const { defaultRule, onRemove, onSubmit, viewMode } = props;

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
          {viewMode === 'rules' ? (
            // Full form in rules view
            <>
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
                        } else if (value) {
                          // Handle single value selection
                          field.onChange([value.value]);
                        } else {
                          // Handle deselection
                          field.onChange([]);
                        }
                      }}
                    />
                  </HStack>
                )}
              />
            </>
          ) : (
            // Just description and children selection in tools view
            <>
              <HStack align="center">
                <Typography variant="body2" color="default">
                  {t('ChildToolRuleEditor.description')}
                </Typography>
              </HStack>
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
                        } else if (value) {
                          // Handle single value selection
                          field.onChange([value.value]);
                        } else {
                          // Handle deselection
                          field.onChange([]);
                        }
                      }}
                    />
                  </HStack>
                )}
              />
            </>
          )}
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Conditional Tool Editor
interface ConditionalToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: ConditionalToolRule;
  viewMode: 'rules' | 'tools';
}

const conditionalToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('conditional'),
  defaultChild: z.string(),
  requireOutputMapping: z.boolean(),
  childOutputMapping: z.record(z.string()),
});

type ConditionalToolRuleFormType = z.infer<typeof conditionalToolRuleSchema>;

export function ConditionalToolEditor(props: ConditionalToolEditorProps) {
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
  viewMode: 'rules' | 'tools';
}

const continueLoopToolRuleSchema = z.object({
  toolNames: z.array(z.string()),
  type: z.literal('continue_loop'),
});

type ContinueToolRuleFormData = z.infer<typeof continueLoopToolRuleSchema>;

export function ContinueToolRuleComponent(props: ContinueToolRuleEditorProps) {
  const {
    defaultRule: _defaultRule,
    onRemove,
    onSubmit,
    allContinueLoopRules = [],
  } = props;

  // Get all tool names that are currently in continue_loop rules
  const currentToolNames = allContinueLoopRules.map((rule) => rule.tool_name);

  const form = useForm<ContinueToolRuleFormData>({
    resolver: zodResolver(continueLoopToolRuleSchema),
    defaultValues: {
      toolNames: currentToolNames.filter((name) => name !== ''), // Only include non-empty tool names
      type: 'continue_loop',
    },
  });
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ContinueToolRuleFormData) => {
      // Create multiple rules, one for each selected tool
      // If no tools selected, create a single empty rule
      const rules =
        data.toolNames.length > 0
          ? data.toolNames.map((toolName) => ({
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
                        value={(field.value as string[]).map((toolName) => ({
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
                            field.onChange(value.map((v) => v.value));
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
  viewMode: 'rules' | 'tools';
}

const exitLoopToolRuleSchema = z.object({
  toolNames: z.array(z.string()),
  type: z.literal('exit_loop'),
});

type ExitLoopToolRuleFormData = z.infer<typeof exitLoopToolRuleSchema>;

export function ExitLoopToolEditor(props: ExitLoopToolEditorProps) {
  const {
    defaultRule: _defaultRule,
    onRemove,
    onSubmit,
    allExitLoopRules = [],
  } = props;

  // Get all tool names that are currently in exit_loop rules
  const currentToolNames = allExitLoopRules.map((rule) => rule.tool_name);

  const form = useForm<ExitLoopToolRuleFormData>({
    resolver: zodResolver(exitLoopToolRuleSchema),
    defaultValues: {
      toolNames: currentToolNames.filter((name) => name !== ''), // Only include non-empty tool names
      type: 'exit_loop',
    },
  });
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ExitLoopToolRuleFormData) => {
      // Create multiple rules, one for each selected tool
      // If no tools selected, create a single empty rule
      const rules =
        data.toolNames.length > 0
          ? data.toolNames.map((toolName) => ({
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
                        value={(field.value as string[]).map((toolName) => ({
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
                            field.onChange(value.map((v) => v.value));
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
  viewMode: 'rules' | 'tools';
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

export function MaxCountPerStepToolRuleEditor(
  props: MaxCountPerStepToolRuleEditorProps,
) {
  const { defaultRule, onRemove, onSubmit, viewMode } = props;

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
          {viewMode === 'rules' ? (
            // Full form with tool selection in rules view
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
                        placeholder={t(
                          'MaxCountPerStepToolRuleEditor.toolName',
                        )}
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
                      <Input
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
          ) : (
            // Read-only tool name with editable count in tools view
            <HStack align="center">
              <Typography variant="body2" color="default">
                {t('MaxCountPerStepToolRuleEditor.description')}
              </Typography>
              <FormField
                name="maxCount"
                render={({ field }) => (
                  <Input
                    hideLabel
                    label={t('MaxCountPerStepToolRuleEditor.count')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Typography variant="body2" color="default">
                {t('MaxCountPerStepToolRuleEditor.timesInLoop')}
              </Typography>
            </HStack>
          )}
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

const requiresApprovalSchema = z.object({
  toolNames: z.array(z.string()),
  type: z.literal('requires_approval'),
});

type RequiresApprovalFormData = z.infer<typeof requiresApprovalSchema>;

interface RequiresApprovalEditorProps extends ToolEditorDefaultProps {
  toolNames: string[];
}

export function RequiresApprovalEditor(props: RequiresApprovalEditorProps) {
  const { onRemove, onSubmit, toolNames = [] } = props;

  const form = useForm<RequiresApprovalFormData>({
    resolver: zodResolver(requiresApprovalSchema),
    defaultValues: {
      toolNames: toolNames.filter((name) => name !== ''), // Only include non-empty tool names
      type: 'requires_approval',
    },
  });
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: RequiresApprovalFormData) => {
      // Create multiple rules, one for each selected tool
      // If no tools selected, create a single empty rule
      const rules =
        data.toolNames.length > 0
          ? data.toolNames.map((toolName) => ({
              tool_name: toolName,
              type: 'requires_approval' as const,
            }))
          : [{ tool_name: '', type: 'requires_approval' as const }];

      // Submit all rules at once
      onSubmit(rules);
      form.reset({
        toolNames: data.toolNames,
        type: 'requires_approval',
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
            type="requires_approval"
            onRemove={onRemove}
          >
            <FormField
              name="toolNames"
              render={({ field }) => (
                <HStack align="center">
                  {t.rich('RequiresApprovalEditor.sentence', {
                    tool: () => (
                      <Select
                        label={t('RequiresApprovalEditor.toolName')}
                        value={(field.value as string[]).map((toolName) => ({
                          value: toolName,
                          label: toolName,
                        }))}
                        isMulti
                        inline
                        hideLabel
                        placeholder={t('RequiresApprovalEditor.toolName')}
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
  viewMode: 'rules' | 'tools';
}

// Add the editor component
export function RequiredBeforeExitToolEditor(
  props: RequiredBeforeExitToolEditorProps,
) {
  const { defaultRule, onRemove, onSubmit, viewMode } = props;

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
          {viewMode === 'rules' ? (
            // Full form with tool selection in rules view
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
          ) : (
            // Just the description in tools view
            <HStack align="center">
              <Typography variant="body2" color="default">
                {t('RequiredBeforeExitToolEditor.description')}
              </Typography>
            </HStack>
          )}
        </ToolRuleItemWrapper>
      </form>
    </FormProvider>
  );
}

// Helper component to render individual tool rule editors
interface ToolRuleEditorProps {
  rule: SupportedToolRuleTypes;
  index: number;
  onRemove: () => void;
  onSubmit: (data: SupportedToolRuleTypes | SupportedToolRuleTypes[]) => void;
  toolRules: SupportedToolRuleTypes[];
  viewMode: 'rules' | 'tools';
}

export function ToolRuleEditor({
  rule,
  index,
  onRemove,
  onSubmit,
  toolRules,
  viewMode,
}: ToolRuleEditorProps) {
  if (rule.type === 'exit_loop') {
    const allExitLoopRules = toolRules?.filter(
      (r): r is TerminalToolRule => r.type === 'exit_loop',
    );
    return (
      <ExitLoopToolEditor
        onRemove={onRemove}
        key={`exit_loop_group_${index}`}
        onSubmit={onSubmit}
        defaultRule={rule}
        allExitLoopRules={allExitLoopRules}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'required_before_exit') {
    return (
      <RequiredBeforeExitToolEditor
        onRemove={onRemove}
        key={index}
        onSubmit={onSubmit}
        defaultRule={rule}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'constrain_child_tools') {
    return (
      <ChildToolRuleEditor
        onRemove={onRemove}
        key={index}
        onSubmit={onSubmit}
        defaultRule={rule}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'conditional') {
    return (
      <ConditionalToolEditor
        onRemove={onRemove}
        key={index}
        onSubmit={onSubmit}
        defaultRule={rule}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'run_first') {
    return (
      <StartConstraintToolEditor
        onRemove={onRemove}
        key={index}
        onSubmit={onSubmit}
        defaultRule={rule}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'requires_approval') {
    const toolNames = toolRules
      ?.filter(
        (r): r is RequiresApprovalToolRule => r.type === 'requires_approval',
      )
      .map((r) => r.tool_name);

    return (
      <RequiresApprovalEditor
        onRemove={onRemove}
        key={`requires_approval_${index}`}
        onSubmit={onSubmit}
        toolNames={toolNames}
      />
    );
  }

  if (rule.type === 'continue_loop') {
    const allContinueLoopRules = toolRules?.filter(
      (r): r is ContinueToolRule => r.type === 'continue_loop',
    );
    return (
      <ContinueToolRuleComponent
        onRemove={onRemove}
        key={`continue_loop_group_${index}`}
        onSubmit={onSubmit}
        defaultRule={rule}
        allContinueLoopRules={allContinueLoopRules}
        viewMode={viewMode}
      />
    );
  }

  if (rule.type === 'max_count_per_step') {
    return (
      <MaxCountPerStepToolRuleEditor
        onRemove={onRemove}
        key={index}
        onSubmit={onSubmit}
        defaultRule={rule}
        viewMode={viewMode}
      />
    );
  }

  return null;
}
