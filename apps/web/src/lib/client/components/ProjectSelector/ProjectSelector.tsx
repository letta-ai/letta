import React, { useCallback, useMemo } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import { useCurrentProject } from '../../hooks/useCurrentProject/useCurrentProject';
import {
  Button,
  Popover,
  ProgressBar,
  SettingsApplicationsIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface ProjectItemProps {
  name: string;
  isCurrent?: boolean;
  id: string;
  onClick: () => void;
  slug: string;
}

function ProjectItem(props: ProjectItemProps) {
  const { name, id, onClick, isCurrent, slug } = props;
  const href = useMemo(() => {
    if (!id) {
      return '/development-servers/local/dashboard';
    }

    return `/projects/${slug}`;
  }, [id, slug]);

  return (
    <Button
      align="left"
      onClick={onClick}
      active={isCurrent}
      color="tertiary"
      size="small"
      fullWidth
      href={href}
      label={name}
      _use_rarely_className="text-text-default"
    />
  );
}
const LIMIT = 5;

interface ProjectSelectorProps {
  trigger: React.ReactNode;
}

export function ProjectSelector(props: ProjectSelectorProps) {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('components/ProjectSelector');

  const currentProject = useCurrentProject();

  const { data, isLoading } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({
      limit: LIMIT,
    }),
    queryData: {
      query: {
        limit: LIMIT,
      },
    },
  });

  const projectsList = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.body.projects.filter(
      (project) => project.id !== currentProject.id,
    );
  }, [currentProject.id, data]);

  const handleClickProject = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Popover
      open={open}
      align="start"
      onOpenChange={setOpen}
      triggerAsChild
      trigger={trigger}
    >
      <VStack padding="small">
        <Typography variant="body4" uppercase color="muted">
          {t('projects')}
        </Typography>
        <ProjectItem
          isCurrent
          id={currentProject.id}
          onClick={handleClickProject}
          name={currentProject.name}
          slug={currentProject.slug}
        />
        {isLoading && <ProgressBar indeterminate />}
        {projectsList.map((project) => (
          <ProjectItem
            id={project.id}
            key={project.id}
            onClick={handleClickProject}
            name={project.name}
            slug={project.slug}
          />
        ))}
        {!isLoading && (
          <Button
            align="left"
            color="tertiary"
            size="small"
            fullWidth
            preIcon={<SettingsApplicationsIcon />}
            href="/projects"
            label={t('seeMore')}
          />
        )}
      </VStack>
    </Popover>
  );
}
