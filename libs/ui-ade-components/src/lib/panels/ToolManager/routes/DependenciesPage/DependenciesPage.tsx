import {
  Button,
  Code,
  Dialog,
  HStack,
  PackageIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

const DEPENDENCIES_LIST = [
  {
    name: 'numpy',
    description: 'Fundamental package for array computing in Python',
    version: '1.26.4',
    source: 'https://pypi.org/project/numpy/',
  },
  {
    name: 'pandas',
    description: 'Data analysis and manipulation tool, built on top of NumPy',
    version: '1.5.3',
    source: 'https://pypi.org/project/pandas/',
  },
  {
    name: 'Pillow',
    description:
      'Python Imaging Library, adds image processing capabilities to your Python interpreter',
    version: '9.4.0',
    source: 'https://pypi.org/project/Pillow/',
  },
  {
    name: 'requests',
    description: 'Simple, yet elegant HTTP library for Python',
    version: '2.31.0',
    source: 'https://pypi.org/project/requests/',
  },
  {
    name: 'scikit-learn',
    description: 'Machine learning in Python',
    version: '1.3.0',
    source: 'https://pypi.org/project/scikit-learn/',
  },
  {
    name: 'scipy',
    description: 'Scientific library for Python',
    version: '1.11.3',
    source: 'https://pypi.org/project/scipy/',
  },
  {
    name: 'urllib3',
    description:
      'HTTP library with thread-safe connection pooling, file post, and more',
    version: '1.26.17',
    source: 'https://pypi.org/project/urllib3/',
  },
  {
    name: 'letta-nightly',
    description: 'Letta Cloud SDK',
    version: 'latest',
    source: 'https://pypi.org/project/letta-nightly/',
  },
];

function UsageDialog() {
  const t = useTranslations('ToolManager/DependenciesPage');

  return (
    <Dialog
      title={t('UsageDialog.title')}
      hideConfirm
      trigger={
        <Button
          label={t('UsageDialog.trigger')}
          color="secondary"
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
          code={`import pandas as pd

def my_function():
    # Use pandas functionality
    df = pd.DataFrame()
    # Your code here
    # ...`}
        />
      </VStack>
    </Dialog>
  );
}

interface DependencyItem {
  name: string;
  description: string;
  version: string;
  source: string;
}

interface DependencyItemProps {
  dependency: DependencyItem;
}

function DependencyItem(props: DependencyItemProps) {
  const { dependency } = props;

  const t = useTranslations('ToolManager/DependenciesPage');

  return (
    <VStack padding="large" gap={false} fullWidth>
      <HStack align="center" justify="spaceBetween">
        <HStack gap="large" align="center">
          <PackageIcon />
          <VStack gap={false}>
            <Typography>{dependency.name}</Typography>
            <Typography variant="body2">{dependency.description}</Typography>
          </VStack>
        </HStack>
        <HStack align="center" gap="large">
          <Typography variant="body2">{dependency.version}</Typography>
          <Button
            label={t('DependencyItem.source')}
            color="secondary"
            size="small"
            href={dependency.source}
            target="_blank"
          />
        </HStack>
      </HStack>
    </VStack>
  );
}

export function DependenciesPage() {
  const t = useTranslations('ToolManager/DependenciesPage');

  return (
    <VStack gap={false} fullWidth fullHeight color="background">
      <VStack gap="small" borderBottom padding="xlarge">
        <HStack align="center" fullWidth>
          <VStack gap="small" fullWidth>
            <HStack align="center" fullWidth>
              <PackageIcon />
              <Typography variant="heading5">{t('title')}</Typography>
            </HStack>
            <Typography>{t('description')}</Typography>
          </VStack>
          <UsageDialog />
        </HStack>
      </VStack>
      <VStack gap="small" collapseHeight flex overflowY="auto">
        {DEPENDENCIES_LIST.map((dependency) => (
          <DependencyItem key={dependency.name} dependency={dependency} />
        ))}
      </VStack>
    </VStack>
  );
}
