'use client';
import { useToolManagerState } from './hooks/useToolManagerState/useToolManagerState';
import {
  BillingLink,
  Button,
  CaretLeftIcon,
  CaretRightIcon,
  ChevronLeftIcon,
  Dialog,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HR,
  HStack,
  Input,
  Select,
  SmallInvaderOutlineIcon,
  MiniApp,
  PlusIcon,
  Tooltip,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { getMatchingRoute } from './toolManagerRoutes';
import { useToolManagerRouteCopy } from './hooks/useToolManagerRouteCopy/useToolManagerRouteCopy';
import type { ToolType } from '@letta-cloud/sdk-core';
import {
  useToolsServiceCreateTool,
  useToolsServiceListTools,
  type Tool,
  UseToolsServiceListToolsKeyFn,
  UseToolsServiceRetrieveToolKeyFn,
  isAPIError,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@letta-cloud/ui-styles';
import { useLocalStorage } from '@mantine/hooks';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { LIST_TOOLS_PAYLOAD } from './routes/MyTools/MyTools';
import { useCurrentAgent } from '../../hooks';
import { useViewportSize, useDebouncedValue } from '@mantine/hooks';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface CreateToolDialogProps {
  trigger: React.ReactNode;
}

function getCode(name: string, language = 'python') {
  if (language === 'typescript') {
    return `export function ${name}(): string {
  /**
   * This is a simple function that returns a string.
   */
  return 'Hello, World!';
}`;
  }
  return `def ${name}():
    """
    This is a simple function that returns a string.
    """
    return 'Hello, World!'
`;
}

export function CreateToolDialog(props: CreateToolDialogProps) {
  const { trigger } = props;
  const t = useTranslations('ToolManager');

  const { setPath } = useToolManagerState();

  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  const CreateToolSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z0-9_]+$/, {
          message: t('CreateToolDialog.restriction'),
        }),
        language: z.string().optional(),
      }),
    [t],
  );

  type CreateToolType = z.infer<typeof CreateToolSchema>;

  const form = useForm<CreateToolType>({
    resolver: zodResolver(CreateToolSchema),
    defaultValues: {
      name: '',
      language: 'python',
    },
  });

  const queryClient = useQueryClient();
  const { setSelectedToolId } = useToolManagerState();

  const { mutate, isPending, error, reset } = useToolsServiceCreateTool({
    onSuccess: (data) => {
      if (!data.id) {
        return;
      }

      // Reset form on success before closing
      form.reset({
        name: '',
        language: 'python',
      });
      reset();
      
      setDialogOpen(false);
      setPath('/my-tools');

      queryClient.setQueriesData<Tool[]>(
        {
          queryKey: UseToolsServiceListToolsKeyFn(LIST_TOOLS_PAYLOAD),
        },
        (oldData) => {
          if (!oldData) {
            return [data];
          }

          return [data, ...oldData];
        },
      );

      queryClient.setQueriesData<Tool>(
        {
          queryKey: UseToolsServiceRetrieveToolKeyFn({
            toolId: data.id,
          }),
        },
        () => data,
      );

      setSelectedToolId(data.id);
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        // Reset form when opening the dialog
        form.reset({
          name: '',
          language: 'python',
        });
        reset();
      } else {
        // Also reset when closing (in case of cancel)
        form.reset({
          name: '',
          language: 'python',
        });
        reset();
      }
      setDialogOpen(open);
    },
    [form, reset],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.status === 402) {
          return t.rich('CreateToolDialog.errors.overage', {
            limit: () => error.body.limit,
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }

        if (error.status === 409) {
          return t('CreateToolDialog.errors.alreadyExists');
        }
      }

      return t('CreateToolDialog.errors.default');
    }

    return undefined;
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: CreateToolType) => {
      const language = values.language || 'python';
      
      trackClientSideEvent(AnalyticsEvent.CREATE_TOOL, {
        toolType: 'custom' as ToolType,
        sourceType: language,
      })

      mutate({
        requestBody: {
          source_code: getCode(values.name, language),
          source_type: language,
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isDialogOpen}
        onOpenChange={handleOpenChange}
        isConfirmBusy={isPending}
        errorMessage={errorMessage}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('CreateToolDialog.title')}
        trigger={trigger}
        testId="create-tool-dialog"
      >
        <VStack gap="medium" fullWidth>
          <Typography variant="body2" color="muted">
            {t('CreateToolDialog.description')}
          </Typography>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                data-testid="create-tool-dialog-name"
                placeholder={t('CreateToolDialog.placeholder')}
                label={t('CreateToolDialog.label')}
                name="name"
              />
            )}
          />
          {typescriptToolsEnabled && (
            <FormField
              name="language"
              render={({ field }) => {
                const options = [
                  { label: 'Python', value: 'python' },
                  { label: 'TypeScript', value: 'typescript' },
                ];
                const selectedOption = options.find(opt => opt.value === (field.value || 'python'));
                
                return (
                  <Select
                    fullWidth
                    value={selectedOption}
                    onSelect={(option) => {
                      if (option && 'value' in option) {
                        field.onChange(option.value);
                      }
                    }}
                    data-testid="create-tool-dialog-language"
                    label={t('CreateToolDialog.languageLabel')}
                    options={options}
                  />
                );
              }}
            />
          )}
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface SidebarButtonProps {
  label: React.ReactNode;
  path: string;
  hideLabel?: boolean;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
  isExpanded?: boolean;
}

function SidebarButton(props: SidebarButtonProps) {
  const { setPath, currentPath } = useToolManagerState();
  const { path, hideLabel, label, icon, isExpanded } = props;

  const isSelected = useMemo(() => {
    return path === currentPath;
  }, [path, currentPath]);
  const buttonContent = (
    <button
      color={isSelected ? 'brand' : 'tertiary'}
      onClick={() => {
        setPath(path);
      }}
      className={cn(
        'w-full flex items-center p-1.5',
        isSelected
          ? 'bg-brand-light text-brand-light-content'
          : 'bg-transparent',
      )}
    >
      <div className="flex gap-2 w-full">
        <div className="w-4 items-center flex justify-center">{icon}</div>
        <div className={cn('', hideLabel ? 'sr-only' : '')}>{label}</div>
      </div>
    </button>
  );

  return isExpanded === false ? (
    <Tooltip asChild content={label}>
      {buttonContent}
    </Tooltip>
  ) : (
    buttonContent
  );
}

interface SidebarSectionProps {
  title: React.ReactNode;
  isExpanded?: boolean;
  children: React.ReactNode;
}

function SidebarSection(props: SidebarSectionProps) {
  const { title, children, isExpanded } = props;

  return (
    <VStack>
      {isExpanded && (
        <HStack paddingX="medium">
          {typeof title === 'string' ? (
            <Typography variant="body4" bold>
              {title}
            </Typography>
          ) : (
            title
          )}
        </HStack>
      )}

      <VStack paddingX="small" gap="small">
        {children}
      </VStack>
    </VStack>
  );
}

interface ExpandComponentProps {
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

function ExpandComponent(props: ExpandComponentProps) {
  const { isExpanded, setExpanded } = props;

  const t = useTranslations('ToolManager');

  const copy = useMemo(() => {
    if (!isExpanded) {
      return t('ToolManagerNavigationSidebar.expand');
    }

    return t('ToolManagerNavigationSidebar.collapse');
  }, [isExpanded, t]);

  return (
    <button
      className="text-text-lighter flex item-center justify-center p-0  h-[27px] top-[28px] w-[17px] bg-background-grey border absolute right-[-10px]"
      onClick={() => {
        setExpanded(!isExpanded);
      }}
    >
      <div className="w-full">
        {!isExpanded ? <CaretRightIcon /> : <CaretLeftIcon />}
        <div className="sr-only">{copy}</div>
      </div>
    </button>
  );
}

// Custom hook for auto-collapsing sidebar based on viewport width
function useAutoCollapseSidebar(
  isExpanded: boolean,
  setExpanded: (expanded: boolean) => void,
) {
  const { width = 0 } = useViewportSize();
  const [debouncedWidth] = useDebouncedValue(width, 100);

  useEffect(() => {
    // Auto-collapse when viewport width is below 768px (tablet breakpoint)
    if (debouncedWidth && debouncedWidth < 768 && isExpanded) {
      setExpanded(false);
    }
  }, [debouncedWidth, isExpanded, setExpanded]);

  return { debouncedWidth };
}

function ToolManagerNavigationSidebar() {
  const t = useTranslations('ToolManager');
  const details = useToolManagerRouteCopy();
  const [isExpanded, setExpanded] = useLocalStorage({
    defaultValue: true,
    key: 'tool-manager-sidebar-expanded',
  });

  // Add auto-collapse functionality
  useAutoCollapseSidebar(isExpanded, setExpanded);

  const { closeToolManager } = useToolManagerState();

  const { name } = useCurrentAgent();
  const { setPath } = useToolManagerState();

  return (
    <VStack
      borderRight
      color="background-grey"
      className={cn(
        'relative',
        isExpanded
          ? 'w-[220px] min-w-[220px] max-w-[220px]'
          : 'w-[50px] max-w-[50px]',
      )}
      gap="medium"
      paddingBottom="xxsmall"
    >
      <HiddenOnMobile>
        <ExpandComponent isExpanded={isExpanded} setExpanded={setExpanded} />
      </HiddenOnMobile>
      {CURRENT_RUNTIME === 'letta-desktop' && <div className="h-[8px]" />}
      <HStack
        minHeight="header-sm"
        height="header-sm"
        fullWidth
        gap={false}
        borderBottom={isExpanded}
        paddingX={isExpanded ? 'xsmall' : 'xsmall'}
        align="center"
      >
        <Button
          label={t('ToolManagerNavigationSidebar.close')}
          size="small"
          color="tertiary"
          hideLabel
          data-testid="close-tool-manager"
          preIcon={<ChevronLeftIcon />}
          onClick={() => {
            closeToolManager();
          }}
        />
        {isExpanded && (
          <Typography variant="body2" bold color="lighter">
            {t('ToolManagerNavigationSidebar.title')}
          </Typography>
        )}
      </HStack>
      <VStack overflowY="auto" gap="medium">
        <SidebarSection
          isExpanded={isExpanded}
          title={
            <HStack align="center" collapseWidth className="gap-2">
              <div className="bg-agent text-agent-content min-w-[24px] flex items-center justify-center h-[24px] rounded-[2px]">
                <SmallInvaderOutlineIcon />
              </div>
              <Tooltip asChild content={name}>
                <Typography
                  fullWidth
                  overflow="ellipsis"
                  variant="body2"
                  noWrap
                  className="cursor-default"
                >
                  {name}
                </Typography>
              </Tooltip>
            </HStack>
          }
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.current.title}
            path="/current-agent-tools"
            hasSubmenu
            icon={details.current.icon}
            isExpanded={isExpanded}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.toolRules.title}
            path="/tool-rules"
            icon={details.toolRules.icon}
            isExpanded={isExpanded}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.toolVariables.title}
            path="/tool-variables"
            icon={details.toolVariables.icon}
            isExpanded={isExpanded}
          />
        </SidebarSection>
        <HR />
        <SidebarSection
          isExpanded={isExpanded}
          title={t('ToolManagerNavigationSidebar.codeTools')}
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.lettaTools.title}
            path="/letta-tools"
            hasSubmenu
            icon={details.lettaTools.icon}
            isExpanded={isExpanded}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.multiAgentTools.title}
            path="/letta-multiagent-tools"
            hasSubmenu
            icon={details.multiAgentTools.icon}
            isExpanded={isExpanded}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.utilityTools.title}
            path="/letta-utility-tools"
            hasSubmenu
            icon={details.utilityTools.icon}
            isExpanded={isExpanded}
          />

          <SidebarButton
            hideLabel={!isExpanded}
            label={details.customTools.title}
            path="/my-tools"
            hasSubmenu
            icon={details.customTools.icon}
            isExpanded={isExpanded}
          />
          <HStack>
            <CreateToolDialog
              trigger={
                <Button
                  hideLabel={!isExpanded}
                  size="xsmall"
                  data-testid="start-create-tool"
                  preIcon={<PlusIcon />}
                  label={t('ToolManagerNavigationSidebar.create')}
                  color="secondary"
                  bold
                />
              }
            />
          </HStack>
        </SidebarSection>
        <HR />

        <SidebarSection
          isExpanded={isExpanded}
          title={t('ToolManagerNavigationSidebar.mcpServerHeader')}
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.mcpServers.title}
            path="/mcp-servers"
            icon={details.mcpServers.icon}
            isExpanded={isExpanded}
          />
          <HStack>
            <Button
              size="xsmall"
              hideLabel={!isExpanded}
              preIcon={<PlusIcon />}
              onClick={() => {
                setPath('/add-mcp-servers');
              }}
              label={t('ToolManagerNavigationSidebar.createServer')}
              color="secondary"
              bold
            />
          </HStack>
        </SidebarSection>
      </VStack>
    </VStack>
  );
}

function ToolManagerContent() {
  const { currentPath } = useToolManagerState();

  const matchingRoute = useMemo(() => {
    return getMatchingRoute(currentPath || '');
  }, [currentPath]);

  return matchingRoute?.component;
}

export function ToolManager() {
  const {
    closeToolManager,
    openToolManager,
    isConfirmationDialogOpen,
    setDialogOpen,
    isToolManagerOpen,
  } = useToolManagerState();

  useToolsServiceListTools();

  const t = useTranslations('ToolManager');

  return (
    <MiniApp
      backdrop
      appName={t('title')}
      isOpen={isToolManagerOpen}
      __use__rarely__className="h-full min-w-[100vw] min-h-[100vh] p-2 bg-background-grey3"
      onOpenChange={(open) => {
        if (!open) {
          closeToolManager();
          return;
        }

        openToolManager('/current-agent-tools');
      }}
    >
      <Dialog
        title={t('confirmLeave.title')}
        isOpen={isConfirmationDialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={() => {
          closeToolManager(true);
        }}
      >
        {t('confirmLeave.description')}
      </Dialog>
      <VStack
        className="shadow-lg"
        color="background"
        gap={false}
        fullHeight
        fullWidth
      >
        <HStack collapseHeight flex gap={false} fullWidth fullHeight>
          <HiddenOnMobile>
            <ToolManagerNavigationSidebar />
          </HiddenOnMobile>
          <ToolManagerContent />
        </HStack>
      </VStack>
    </MiniApp>
  );
}
