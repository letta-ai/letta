import { useCallback } from 'react';
import { useCurrentTool } from '../../LocalToolViewer/LocalToolViewer';
import { useStagedCode } from '../../../hooks/useStagedCode/useStagedCode';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface ModifyDependencyType {
  name: string;
  version?: string;
}

export function useManageDependencies() {
  const tool = useCurrentTool();
  const { stagedTool, setStagedTool } = useStagedCode(tool);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');
  
  const isTypeScript = typescriptToolsEnabled && stagedTool.source_type === 'typescript';

  const handleAdd = useCallback(
    (dependency: ModifyDependencyType) => {
      setStagedTool((prevTool) => {
        if (!prevTool.id) {
          return prevTool;
        }

        if (isTypeScript) {
          // Handle npm requirements for TypeScript tools
          const currentNpmRequirements = prevTool.npm_requirements || [];
          const dependencyExists = currentNpmRequirements.some(
            (req) => req.name === dependency.name,
          );

          if (dependencyExists) {
            return prevTool;
          }

          const updatedNpmRequirements = [
            ...currentNpmRequirements,
            {
              name: dependency.name,
              ...(dependency.version && { version: dependency.version }),
            },
          ];

          return {
            ...prevTool,
            npm_requirements: updatedNpmRequirements,
          };
        } else {
          // Handle pip requirements for Python tools
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
        }
      });
    },
    [setStagedTool, isTypeScript],
  );

  const handleRemove = useCallback(
    (dependency: ModifyDependencyType) => {
      setStagedTool((prevTool) => {
        if (isTypeScript) {
          // Handle npm requirements for TypeScript tools
          const updatedRequirements = prevTool.npm_requirements?.filter(
            (req) => req.name !== dependency.name,
          );

          return {
            ...prevTool,
            npm_requirements: updatedRequirements || [],
          };
        } else {
          // Handle pip requirements for Python tools
          const updatedRequirements = prevTool.pip_requirements?.filter(
            (req) => req.name !== dependency.name,
          );

          return {
            ...prevTool,
            pip_requirements: updatedRequirements || [],
          };
        }
      });
    },
    [setStagedTool, isTypeScript],
  );

  return {
    addDependency: handleAdd,
    removeDependency: handleRemove,
  };
}
