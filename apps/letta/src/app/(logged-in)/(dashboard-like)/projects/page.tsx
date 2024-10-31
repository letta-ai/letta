'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Avatar,
  Button,
  LoadingEmptyStatusComponent,
  DashboardPageLayout,
  HStack,
  PlusIcon,
  Typography,
  Dialog,
  VStack,
  useForm,
  FormField,
  Input,
  FormProvider,
  DashboardPageSection,
  RawCodeEditor,
  NiceGridDisplay,
  Card,
  Tooltip,
  HiddenOnMobile,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ComputerIcon } from '@letta-web/component-library';
import { getIsLocalServiceOnline } from '$letta/client/local-project-manager/getIsLocalServerOnline/getIsLocalServerOnline';
import { LOCAL_PROJECT_SERVER_PORT } from '$letta/constants';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';
import Link from 'next/link';

function useIsLocalServiceOnline() {
  const [isLocalServiceOnline, setIsOnline] = React.useState(false);
  const interval = useRef<ReturnType<typeof setTimeout>>();

  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    mounted.current = true;

    void getIsLocalServiceOnline().then(setIsOnline);
  }, []);

  useEffect(() => {
    interval.current = setInterval(async () => {
      void getIsLocalServiceOnline().then(setIsOnline);
    }, 3000);

    return () => {
      clearInterval(interval.current);
    };
  }, []);

  return { isLocalServiceOnline };
}

function ConnectToLocalProjectDialog() {
  const t = useTranslations('projects/page');
  const { push } = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleFirstConnect = useCallback(async () => {
    setPending(true);

    const isOnline = await getIsLocalServiceOnline();

    if (isOnline) {
      push('/local-project/agents');
    } else {
      setOpen(true);
    }

    setPending(false);
  }, [push]);

  return (
    <>
      <Button
        onClick={handleFirstConnect}
        preIcon={<ComputerIcon />}
        busy={pending}
        color="tertiary"
        label={t('connectToLocalProject.triggerButton')}
      />
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={t('connectToLocalProject.title')}
        hideConfirm
      >
        <Typography>{t('connectToLocalProject.instructions')}</Typography>
        <RawCodeEditor
          fullWidth
          toolbarPosition="bottom"
          label="Command to connect"
          hideLabel
          language="bash"
          code={`letta server --ade --port=${LOCAL_PROJECT_SERVER_PORT}`}
        />
      </Dialog>
    </>
  );
}

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

  const { mutate } = webApi.projects.createProject.useMutation({
    onSuccess: async (res) => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.projects.getProjects,
      });

      push(`/projects/${res.body.slug}`);
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createProjectFormSchema>) => {
      mutate({
        body: {
          name: values.name,
        },
      });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('createProjectDialog.title')}
        confirmText={t('createProjectDialog.createButton')}
        isOpen={isOpen}
        testId="create-project-dialog"
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Button
            data-testid="create-project-button"
            preIcon={<PlusIcon />}
            color="secondary"
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

  return (
    <Link href={url}>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <Card className="hover:bg-background-grey">
        <VStack fullWidth>
          <VStack gap="medium" fullWidth>
            <Avatar size="medium" name={projectName} />
            <VStack gap="text">
              <Tooltip asChild content={projectName}>
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
              </Tooltip>
              <HStack>
                {
                  <Typography variant="body" color="muted">
                    {lastUpdatedAt
                      ? t('projectsList.projectItem.lastUpdatedAt', {
                          date: nicelyFormattedDateAndTime(lastUpdatedAt),
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

  const { isLocalServiceOnline } = useIsLocalServiceOnline();

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
        {isLocalServiceOnline && (
          <ProjectCard
            projectId="local"
            projectName={t('projectsList.localProjectName')}
            lastUpdatedAt=""
            url="/local-project/agents"
          />
        )}
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

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <>
          <HiddenOnMobile>
            <ConnectToLocalProjectDialog />
          </HiddenOnMobile>
          <CreateProjectDialog />
        </>
      }
    >
      <DashboardPageSection
        searchPlaceholder={t('searchInput.placeholder')}
        searchValue={search}
        onSearch={setSearch}
      >
        <ProjectsList search={search} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectsPage;
