import {
  Button,
  HStack,
  PlusIcon,
  Typography,
  VStack,
  TrashIcon,
  InfoTooltip,
  Dialog,
  Code,
  CodeIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { Dependency } from './types';
import { useMemo } from 'react';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { useCurrentTool } from '../LocalToolViewer/LocalToolViewer';
import { useManageDependencies } from './useManageDependencies/useManageDependencies';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface DependencyItemProps {
  dependency: Dependency;
}

interface UsageDialogProps {
  name: string;
}

function UsageDialog(props: UsageDialogProps) {
  const { name } = props;
  const t = useTranslations('DependencyViewer');
  const tool = useCurrentTool();
  const { stagedTool } = useStagedCode(tool);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  const isTypeScript = typescriptToolsEnabled && stagedTool.source_type === 'typescript';

  const pyImportName = useMemo(() => {
    return name.includes('-') ? name.replace(/-/g, '_') : name;
  }, [name]);

  const codeExample = useMemo(() => {
    if (isTypeScript) {
      // TypeScript/JavaScript example
      const importStatement = name.startsWith('@')
        ? `import * as pkg from '${name}';`
        : `import * as ${name.replace(/-/g, '_')} from '${name}';`;

      return {
        language: 'typescript' as const,
        code: `${importStatement}

export async function myFunction() {
    // Use ${name} functionality
    const result = await ${name.replace(/-/g, '_')}.someMethod();
    // Your code here
    // ...
    return result;
}`
      };
    } else {
      // Python example
      return {
        language: 'python' as const,
        code: `import ${pyImportName}

def my_function():
    # Use ${name} functionality
    df = ${pyImportName}.yourfunction()
    # Your code here
    # ...`
      };
    }
  }, [name, pyImportName, isTypeScript]);

  return (
    <Dialog
      title={t('UsageDialog.title')}
      hideConfirm
      trigger={
        <Button
          preIcon={<CodeIcon />}
          hideLabel
          label={t('UsageDialog.trigger')}
          color="tertiary"
          size="small"
        />
      }
    >
      <VStack gap="large">
        <Typography>{t('UsageDialog.description')}</Typography>
        <Code
          fontSize="small"
          showLineNumbers={false}
          language={codeExample.language}
          code={codeExample.code}
        />
      </VStack>
    </Dialog>
  );
}

export function DependencyItem({ dependency }: DependencyItemProps) {
  const t = useTranslations('DependencyViewer');
  const { id, name, version, description, included } = dependency;
  const tool = useCurrentTool();
  const { stagedTool } = useStagedCode(tool);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  const { addDependency, removeDependency } = useManageDependencies();

  const isTypeScript = typescriptToolsEnabled && stagedTool.source_type === 'typescript';

  const isAdded = useMemo(() => {
    if (isTypeScript) {
      const currentNpmRequirements = stagedTool.npm_requirements || [];
      return currentNpmRequirements.some((req) => req.name === dependency.name);
    } else {
      const currentPipRequirements = stagedTool.pip_requirements || [];
      return currentPipRequirements.some((req) => req.name === dependency.name);
    }
  }, [stagedTool.pip_requirements, stagedTool.npm_requirements, dependency.name, isTypeScript]);

  return (
    <VStack key={id} gap={false} borderBottom padding="medium" fullWidth>
      <HStack align="center" justify="spaceBetween" fullWidth gap="medium">
        <VStack gap="small" flex>
          <Typography bold>
            {name}{' '}
            <Typography
              variant="body3"
              color="lighter"
              inline
              overrideEl="span"
            >
              {version}
            </Typography>
          </Typography>
          {description && (
            <Typography variant="body2" color="muted">
              {description}
            </Typography>
          )}
        </VStack>
        <HStack gap="small" align="center">
          {(isAdded || included) && <UsageDialog name={name} />}
          {included ? (
            <InfoTooltip text={t('included')} />
          ) : (
            <>
              {isAdded && (
                <Button
                  label={t('button.remove')}
                  size="small"
                  color="tertiary"
                  hideLabel
                  bold
                  preIcon={<TrashIcon />}
                  onClick={() => {
                    removeDependency(dependency);
                  }}
                />
              )}
              {!isAdded && (
                <Button
                  label={t('button.add')}
                  size="small"
                  color="tertiary"
                  hideLabel
                  bold
                  preIcon={<PlusIcon />}
                  onClick={() => {
                    addDependency(dependency);
                  }}
                />
              )}
            </>
          )}
        </HStack>
      </HStack>
    </VStack>
  );
}
