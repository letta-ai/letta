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

interface DependencyItemProps {
  dependency: Dependency;
}

interface UsageDialogProps {
  name: string;
}

function UsageDialog(props: UsageDialogProps) {
  const { name } = props;
  const t = useTranslations('DependencyViewer');

  const pyImportName = useMemo(() => {
    return name.includes('-') ? name.replace(/-/g, '_') : name;
  }, [name]);

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
          language="python"
          code={`import ${pyImportName}

def my_function():
    # Use {name} functionality
    df = ${pyImportName}.yourfunction()
    # Your code here
    # ...`}
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

  const { addDependency, removeDependency } = useManageDependencies();

  const isAdded = useMemo(() => {
    const currentPipRequirements = stagedTool.pip_requirements || [];
    return currentPipRequirements.some((req) => req.name === dependency.name);
  }, [stagedTool.pip_requirements, dependency.name]);

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
