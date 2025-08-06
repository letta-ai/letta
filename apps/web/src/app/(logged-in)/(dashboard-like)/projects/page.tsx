'use client';
import React, { useCallback, useEffect } from 'react';
import {
  Avatar,
  Button,
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import {
  useFormatters,
  useErrorTranslationMessage,
} from '@letta-cloud/utils-client';
import Link from 'next/link';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { BillingLink } from '@letta-cloud/ui-component-library';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';

import { webApi, webApiContracts, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface ProjectsListProps {
  search: string;
}

const createProjectFormSchema = z.object({
  name: z.string(),
});

function CreateProjectDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const t = useTranslations('projects/page');
  const { push } = useRouter();
  const form = useForm<z.infer<typeof createProjectFormSchema>>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: '',
    },
  });
  const queryClient = useQueryClient();

  const { mutate, isPending, error, isSuccess } =
    webApi.projects.createProject.useMutation({
      onSuccess: async (res) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjects,
        });

        push(`/projects/${res.body.slug}`);
      },
    });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      projectLimitReached: t.rich(
        'createProjectDialog.errors.projectLimitReached',
        {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        },
      ),
      noPermission: t('createProjectDialog.errors.noPermission'),
      default: t('createProjectDialog.errors.default'),
    },
    contract: webApiContracts.projects.createProject,
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createProjectFormSchema>) => {
      mutate({
        body: {
          name: values.name,
        },
      });
    },
    [mutate],
  );

  const [canCRDProjects] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  );

  if (!canCRDProjects) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={errorTranslation?.message}
        title={t('createProjectDialog.title')}
        confirmText={t('createProjectDialog.createButton')}
        isOpen={isOpen}
        testId="create-project-dialog"
        onOpenChange={setIsOpen}
        isConfirmBusy={isPending || isSuccess}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Button
            data-testid="create-project-button"
            preIcon={<PlusIcon />}
            color="primary"
            label={t('createProjectDialog.triggerButton')}
          />
        }
      >
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input
                data-testid="project-name-input"
                fullWidth
                {...field}
                label={t('createProjectDialog.nameInput.label')}
              />
            )}
            name="name"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface ProjectCardProps {
  projectId: string;
  projectName: string;
  lastUpdatedAt?: string;
  url: string;
}

function ProjectCard(props: ProjectCardProps) {
  const { projectName, lastUpdatedAt, url } = props;
  const t = useTranslations('projects/page');
  const { formatDateAndTime } = useFormatters();

  return (
    <Link href={url}>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <Card className="bg-project-card-background border border-background-grey3-border hover:bg-background-grey2">
        <VStack fullWidth>
          <VStack gap="medium" fullWidth>
            <Avatar size="medium" name={projectName} />
            <VStack gap="text">
              <Typography
                bold
                align="left"
                variant="body"
                noWrap
                fullWidth
                overflow="ellipsis"
              >
                {projectName}
              </Typography>
              <HStack>
                {
                  <Typography variant="body" color="muted">
                    {lastUpdatedAt
                      ? t('projectsList.projectItem.lastUpdatedAt', {
                          date: formatDateAndTime(lastUpdatedAt),
                        })
                      : t('projectsList.projectItem.noLastUpdatedAt')}
                  </Typography>
                }
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </Card>
    </Link>
  );
}

function ProjectsList(props: ProjectsListProps) {
  const t = useTranslations('projects/page');
  const [debouncedSearch] = useDebouncedValue(props.search, 500);
  const { data, isError } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({
      search: debouncedSearch,
    }),
    queryData: {
      query: {
        search: debouncedSearch,
      },
    },
  });

  if (!data || isError || data.body.projects.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={!data}
        isError={isError}
        emptyMessage={
          debouncedSearch
            ? t('projectsList.noSearchResults')
            : t('projectsList.noProjects')
        }
        emptyAction={<CreateProjectDialog />}
        loadingMessage="Loading projects..."
      />
    );
  }

  return (
    <>
      <NiceGridDisplay>
        {data.body.projects.map((project) => (
          <ProjectCard
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            lastUpdatedAt={project.updatedAt}
            url={`/projects/${project.slug}`}
          />
        ))}
      </NiceGridDisplay>
    </>
  );
}

function ProjectsPage() {
  const [search, setSearch] = React.useState('');
  const t = useTranslations('projects/page');
  const searchParams = useSearchParams();
  const importDialogTriggerRef = React.useRef<HTMLButtonElement>(null);

  const targetAgentId = searchParams.get('import-agent');

  const {
    data: targetAgentfile,
    isError,
    isLoading,
  } = webApi.agentfile.getAgentfile.useQuery({
    queryData: {
      params: {
        agentId: targetAgentId!,
      },
    },
    queryKey: webApiQueryKeys.agentfile.getAgentfile(targetAgentId!),
    enabled: !!targetAgentId,
    retry: false,
  });

  useEffect(() => {
    if (targetAgentId && targetAgentfile?.body) {
      console.log(
        'Import agent ID found, opening import dialog:',
        targetAgentId,
      );
      // Programmatically trigger the dialog
      importDialogTriggerRef.current?.click();
    }
  }, [targetAgentId, targetAgentfile]);

  if (isLoading) {
    return (
      <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
    );
  }

  if (isError) {
    return (
      <LoadingEmptyStatusComponent
        isError
        errorMessage={t('errorLoadingAgentfile')}
      />
    );
  }

  return (
    <>
      {targetAgentfile && (
        <ImportAgentsDialog
          supportTemplateUploading
          trigger={
            <button
              ref={importDialogTriggerRef}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          }
          agentfileData={targetAgentfile.body}
        />
      )}
      <DashboardPageLayout title={t('title')} actions={<CreateProjectDialog />}>
        <DashboardPageSection
          searchPlaceholder={t('searchInput.placeholder')}
          searchValue={search}
          onSearch={setSearch}
        >
          <ProjectsList search={search} />
        </DashboardPageSection>
      </DashboardPageLayout>
    </>
  );
}

export default ProjectsPage;
