// used to persist navigation even if the user leaves the project UI
import { useSessionStorage } from '@mantine/hooks';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface LastActiveProjectState {
  slug: string;
  name: string;
}

export function useLastActiveProject() {
  const [lastActiveProject, setLastActiveProject] =
    useSessionStorage<LastActiveProjectState | null>({
      key: 'lastActiveProject',
    });

  const pathname = usePathname();

  const project = useCurrentProject();
  const developmentServer = useCurrentDevelopmentServerConfig();

  const shouldClearLastActiveProject = useMemo(() => {
    // Clear last active project if we are on the development server or projects page
    return developmentServer || pathname === '/projects';
  }, [developmentServer, pathname]);

  useEffect(() => {
    if (shouldClearLastActiveProject) {
      setLastActiveProject(null);
    }

    if (!project.id) {
      return;
    }

    if (project.slug === lastActiveProject?.slug) {
      return;
    }

    setLastActiveProject({
      slug: project.slug,
      name: project.name,
    });
  }, [shouldClearLastActiveProject, project, lastActiveProject, setLastActiveProject]);

  if (shouldClearLastActiveProject) {
    return null;
  }

  return lastActiveProject;
}
