import { useToolManagerState } from './hooks/useToolManagerState/useToolManagerState';
import {
  Button,
  CaretLeftIcon,
  CaretRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Dialog,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HR,
  HStack,
  Input,
  LettaInvaderIcon,
  MiniApp,
  PlusIcon,
  Tooltip,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { getMatchingRoute } from './toolManagerRoutes';
import { useToolManagerRouteCopy } from './hooks/useToolManagerRouteCopy/useToolManagerRouteCopy';
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
import { useIsComposioConnected } from './hooks/useIsComposioConnected/useIsComposioConnected';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { LIST_TOOLS_PAYLOAD } from './routes/MyTools/MyTools';
import { useCurrentAgent } from '../../hooks';

interface CreateToolDialogProps {
  trigger: React.ReactNode;
}

function getCode(name: string) {
  return `def ${name}():
    """
    This is a simple function that returns a string.
    """
    return 'Hello, World!'
`;
}

function CreateToolDialog(props: CreateToolDialogProps) {
  const { trigger } = props;
  const t = useTranslations('ToolManager');

  const { setPath } = useToolManagerState();

  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const CreateToolSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z0-9_]+$/, {
          message: t('CreateToolDialog.restriction'),
        }),
      }),
    [t],
  );

  type CreateToolType = z.infer<typeof CreateToolSchema>;

  const form = useForm<CreateToolType>({
    resolver: zodResolver(CreateToolSchema),
    defaultValues: {
      name: '',
    },
  });

  const queryClient = useQueryClient();
  const { setSelectedToolId } = useToolManagerState();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceCreateTool({
      onSuccess: (data) => {
        if (!data.id) {
          return;
        }

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
      setDialogOpen(open);
      if (!open) {
        reset();
        form.reset();
      }
    },
    [form, reset],
  );

  const errorMessage = useMemo(() => {
    if (error && isAPIError(error)) {
      if (error.status === 409) {
        return t('CreateToolDialog.errorAlreadyExists');
      }
    }

    return t('CreateToolDialog.error');
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: CreateToolType) => {
      mutate({
        requestBody: {
          source_code: getCode(values.name),
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
        errorMessage={isError ? errorMessage : undefined}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('CreateToolDialog.title')}
        trigger={trigger}
        testId="create-tool-dialog"
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              data-testid="create-tool-dialog-name"
              placeholder={t('CreateToolDialog.placeholder')}
              description={t('CreateToolDialog.description')}
              label={t('CreateToolDialog.label')}
              name="name"
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

interface SidebarButtonProps {
  label: string;
  path: string;
  hideLabel?: boolean;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
}

function SidebarButton(props: SidebarButtonProps) {
  const { setPath, currentPath } = useToolManagerState();
  const { path, hideLabel, label, icon, hasSubmenu } = props;

  const isSelected = useMemo(() => {
    return path === currentPath;
  }, [path, currentPath]);
  return (
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
      {hasSubmenu && !hideLabel ? (
        <div>
          <ChevronRightIcon />
        </div>
      ) : (
        <div />
      )}
    </button>
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
    <Tooltip placement="bottom" content={copy} asChild>
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
    </Tooltip>
  );
}

function ToolManagerNavigationSidebar() {
  const t = useTranslations('ToolManager');
  const details = useToolManagerRouteCopy();
  const [isExpanded, setExpanded] = useLocalStorage({
    defaultValue: true,
    key: 'tool-manager-sidebar-expanded',
  });
  const { closeToolManager } = useToolManagerState();

  const { name } = useCurrentAgent();

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
              <div className="bg-agent min-w-[24px] flex items-center justify-center h-[24px]">
                <LettaInvaderIcon />
              </div>
              <Typography fullWidth overflow="ellipsis" variant="body2" noWrap>
                {name}
              </Typography>
            </HStack>
          }
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.current.title}
            path="/current-agent-tools"
            hasSubmenu
            icon={details.current.icon}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.toolRules.title}
            path="/tool-rules"
            icon={details.toolRules.icon}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.toolVariables.title}
            path="/tool-variables"
            icon={details.toolVariables.icon}
          />
        </SidebarSection>
        <HR />
        <SidebarSection
          isExpanded={isExpanded}
          title={t('ToolManagerNavigationSidebar.codeTools')}
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.customTools.title}
            path="/my-tools"
            hasSubmenu
            icon={details.customTools.icon}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.lettaTools.title}
            path="/letta-tools"
            hasSubmenu
            icon={details.lettaTools.icon}
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
          title={t('ToolManagerNavigationSidebar.integrationTools')}
        >
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.composioTools.title}
            path="/composio"
            icon={details.composioTools.icon}
          />
          <SidebarButton
            hideLabel={!isExpanded}
            label={details.mcpServers.title}
            path="/mcp-servers"
            icon={details.mcpServers.icon}
          />
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
  useIsComposioConnected();

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
