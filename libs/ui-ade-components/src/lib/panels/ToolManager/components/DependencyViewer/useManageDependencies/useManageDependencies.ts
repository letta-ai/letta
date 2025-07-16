import { useCallback } from 'react';
import { useCurrentTool } from '../../LocalToolViewer/LocalToolViewer';
import { useStagedCode } from '../../../hooks/useStagedCode/useStagedCode';

interface ModifyDependencyType {
  name: string;
  version?: string;
}

export function useManageDependencies() {
  const tool = useCurrentTool();
  const { setStagedTool } = useStagedCode(tool);

  const handleAdd = useCallback(
    (dependency: ModifyDependencyType) => {
      setStagedTool((prevTool) => {
        if (!prevTool.id) {
          return prevTool;
        }

        const currentPipRequirements = prevTool.pip_requirements || [];
        const dependencyExists = currentPipRequirements.some(
          (req) => req.name === dependency.name,
        );

        if (dependencyExists) {
          return prevTool;
        }

        const updatedPipRequirements = [
          ...currentPipRequirements,
          {
            name: dependency.name,
            ...(dependency.version && { version: dependency.version }),
          },
        ];

        return {
          ...prevTool,
          pip_requirements: updatedPipRequirements,
        };
      });
    },
    [setStagedTool],
  );

  const handleRemove = useCallback(
    (dependency: ModifyDependencyType) => {
      setStagedTool((prevTool) => {
        const updatedRequirements = prevTool.pip_requirements?.filter(
          (req) => req.name !== dependency.name,
        );

        return {
          ...prevTool,
          pip_requirements: updatedRequirements || [],
        };
      });
    },
    [setStagedTool],
  );

  return {
    addDependency: handleAdd,
    removeDependency: handleRemove,
  };
}
