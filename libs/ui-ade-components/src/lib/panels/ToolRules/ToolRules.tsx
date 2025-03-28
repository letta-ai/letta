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
  LoadingEmptyStatusComponent,
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
} from '@letta-cloud/sdk-core';
import type {
  AgentState,
  ContinueToolRule,
  ChildToolRule,
  ConditionalToolRule,
  InitToolRule,
  TerminalToolRule,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useFormContext } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { deepEquals } from 'nx/src/utils/json-diff';

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
    }

    return null;
  }, [type]);
}

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

interface ToolEditorDefaultProps {
  onSubmit: (data: SupportedToolRuleTypes) => void;
  onRemove: () => void;
}

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
                  labelVariant="simple"
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

interface ContinueToolRuleEditorProps extends ToolEditorDefaultProps {
  defaultRule: ContinueToolRule;
}

const continueLoopToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('continue_loop'),
});

type ContinueToolRuleRule = z.infer<typeof continueLoopToolRuleSchema>;

function ContinueToolRuleComponent(props: ContinueToolRuleEditorProps) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<ContinueToolRuleRule>({
    resolver: zodResolver(continueLoopToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'continue_loop',
    },
  });
  const { tools } = useCurrentAgent();

  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ContinueToolRuleRule) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'continue_loop',
      });
      form.reset({
        toolName: data.toolName,
        type: 'continue_loop',
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
          type="continue_loop"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ContinueToolRule.sentence', {
                  tool: () => (
                    <Select
                      label={t('ContinueToolRule.toolName')}
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
                      placeholder={t('ContinueToolRule.toolName')}
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

interface ExitLoopToolEditorProps extends ToolEditorDefaultProps {
  defaultRule: TerminalToolRule;
}

const exitLoopToolRuleSchema = z.object({
  toolName: z.string(),
  type: z.literal('exit_loop'),
});

type ExitLoopToolRule = z.infer<typeof exitLoopToolRuleSchema>;

function ExitLoopToolEditor(props: ExitLoopToolEditorProps) {
  const { defaultRule, onRemove, onSubmit } = props;

  const form = useForm<ExitLoopToolRule>({
    resolver: zodResolver(exitLoopToolRuleSchema),
    defaultValues: {
      toolName: defaultRule.tool_name,
      type: 'exit_loop',
    },
  });
  const { tools } = useCurrentAgent();

  const t = useTranslations('ADE/ToolRules');

  const handleSubmit = useCallback(
    (data: ExitLoopToolRule) => {
      onSubmit({
        tool_name: data.toolName,
        type: 'exit_loop',
      });
      form.reset({
        toolName: data.toolName,
        type: 'exit_loop',
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
          type="exit_loop"
          onRemove={onRemove}
        >
          <FormField
            name="toolName"
            render={({ field }) => (
              <HStack align="center">
                {t.rich('ExitLoopToolEditor.sentence', {
                  tool: () => (
                    <Select
                      label={t('ExitLoopToolEditor.toolName')}
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
                      placeholder={t('ExitLoopToolEditor.toolName')}
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

type SupportedToolRuleTypes =
  | ChildToolRule
  | ConditionalToolRule
  | ContinueToolRule
  | InitToolRule
  | MaxCountPerStepToolRule
  | TerminalToolRule;

type SupportedToolRuleNameTypes =
  | 'conditional'
  | 'constrain_child_tools'
  | 'continue_loop'
  | 'exit_loop'
  | 'max_count_per_step'
  | 'run_first';

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
      {/*<NewRuleButton*/}
      {/*  onSelect={() => {*/}
      {/*    onSelect('conditional');*/}
      {/*  }}*/}
      {/*  title={t('toolTypes.conditional.title')}*/}
      {/*  description={t('toolTypes.conditional.description')}*/}
      {/*  icon={<ConditionalIcon />}*/}
      {/*/>*/}
    </DropdownMenu>
  );
}

interface ToolRuleListProps {
  defaultToolRules: AgentState['tool_rules'];
}

export function ToolRuleList(props: ToolRuleListProps) {
  const { defaultToolRules } = props;

  const [search, setSearch] = React.useState('');

  const { id: agentId } = useCurrentAgent();
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
    (nextTools: AgentState['tool_rules']) => {
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
    return toolRules.filter((rule) => {
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
        rule === 'continue_loop'
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
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSaveRule = useCallback(
    (index: number, rule: SupportedToolRuleTypes) => {
      setToolRules((prev) => {
        return prev.map((item, i) => {
          if (i === index) {
            return rule;
          }

          return item;
        });
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
          {filteredRules.map((rule, index) => {
            if (rule.type === 'exit_loop') {
              return (
                <ExitLoopToolEditor
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
              return (
                <ContinueToolRuleComponent
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

export function ToolRulesEditor() {
  const { tool_rules, tools } = useCurrentAgent();

  if (Array.isArray(tools)) {
    return <ToolRuleList defaultToolRules={tool_rules} />;
  }

  return <LoadingEmptyStatusComponent />;
}
