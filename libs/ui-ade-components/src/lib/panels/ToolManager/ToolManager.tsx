import { useToolManagerState } from './hooks/useToolManagerState/useToolManagerState';
import {
  Button,
  Dialog,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  Input,
  LeftPanelCloseIcon,
  LeftPanelOpenIcon,
  MiniApp,
  PlusIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { Hr } from '@react-email/components';
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
import { useAtom } from 'jotai';
import { myToolsSelectedId } from './routes/MyTools/MyTools';
import { useIsComposioConnected } from './hooks/useIsComposioConnected/useIsComposioConnected';

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
  const [_, setMyToolsSelectedId] = useAtom(myToolsSelectedId);

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
            queryKey: UseToolsServiceListToolsKeyFn(),
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

        setMyToolsSelectedId(data.id);
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
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
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
}

function SidebarButton(props: SidebarButtonProps) {
  const { setPath, currentPath } = useToolManagerState();
  const { path, hideLabel, label, icon } = props;

  return (
    <Button
      preIcon={icon}
      size="small"
      hideLabel={hideLabel}
      label={label}
      color="tertiary"
      active={path === currentPath}
      onClick={() => {
        setPath(path);
      }}
    />
  );
}

function ToolManagerNavigationSidebar() {
  const t = useTranslations('ToolManager');
  const details = useToolManagerRouteCopy();
  const [isExpanded, setExpanded] = useLocalStorage({
    defaultValue: true,
    key: 'tool-manager-sidebar-expanded',
  });

  return (
    <VStack
      borderRight
      color="background-grey"
      className={cn(
        isExpanded
          ? 'w-[220px] min-w-[220px] max-w-[220px]'
          : 'w-[50px] max-w-[50px]',
      )}
      gap="medium"
      paddingX="medium"
      paddingBottom="xxsmall"
    >
      <HStack
        height="header-sm"
        justify="spaceBetween"
        fullWidth
        borderBottom
        align="center"
      >
        {isExpanded && (
          <Typography variant="body3" bold>
            {t('ToolManagerNavigationSidebar.title')}
          </Typography>
        )}
        <HiddenOnMobile>
          <Button
            size="small"
            hideLabel
            onClick={() => {
              setExpanded(!isExpanded);
            }}
            preIcon={
              !isExpanded ? <LeftPanelOpenIcon /> : <LeftPanelCloseIcon />
            }
            label={
              isExpanded
                ? t('ToolManagerNavigationSidebar.collapse')
                : t('ToolManagerNavigationSidebar.expand')
            }
            color="tertiary"
          />
        </HiddenOnMobile>
      </HStack>
      <SidebarButton
        hideLabel={!isExpanded}
        label={details.current.title}
        path="/current-agent-tools"
        icon={details.current.icon}
      />
      <SidebarButton
        hideLabel={!isExpanded}
        label={details.toolRules.title}
        path="/tool-rules"
        icon={details.toolRules.icon}
      />
      {isExpanded && (
        <Typography variant="body4" uppercase bold>
          {t('ToolManagerNavigationSidebar.codeTools')}
        </Typography>
      )}
      <SidebarButton
        hideLabel={!isExpanded}
        label={details.customTools.title}
        path="/my-tools"
        icon={details.customTools.icon}
      />
      <SidebarButton
        hideLabel={!isExpanded}
        label={details.lettaTools.title}
        path="/letta-tools"
        icon={details.lettaTools.icon}
      />
      <CreateToolDialog
        trigger={
          <Button
            hideLabel={!isExpanded}
            size="small"
            data-testid="start-create-tool"
            preIcon={<PlusIcon />}
            label={t('ToolManagerNavigationSidebar.create')}
            color={isExpanded ? 'primary' : 'tertiary'}
          />
        }
      />

      <Hr />
      {isExpanded && (
        <HStack>
          <Typography variant="body4" uppercase bold>
            {t('ToolManagerNavigationSidebar.integrationTools')}
          </Typography>
        </HStack>
      )}
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
      <HStack gap={false} fullWidth fullHeight>
        <HiddenOnMobile>
          <ToolManagerNavigationSidebar />
        </HiddenOnMobile>
        <ToolManagerContent />
      </HStack>
    </MiniApp>
  );
}
