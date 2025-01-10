import { useTranslations } from '@letta-cloud/translations';
import { DesktopPageLayout } from '../shared/DesktopPageLayout/DesktopPageLayout';
import {
  Alert,
  AnthropicLogoMarkDynamic,
  AzureLogoMarkDynamic,
  Button,
  CommunicationsIcon,
  ComposioLogoMarkDynamic,
  Dialog,
  HStack,
  Link,
  LoadingEmptyStatusComponent,
  OllamaLogoMarkDynamic,
  OpenaiLogoMarkDynamic,
  RawInput,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Slot } from '@radix-ui/react-slot';

interface ConfigSchemaItem {
  key: string;
  label: string;
}

interface ConfigurationDetails {
  config: Record<string, string>;
  setConfig: (config: Record<string, string>) => void;
}

interface IntegrationConfigurationDialogProps extends ConfigurationDetails {
  name: string;
  configSchema: ConfigSchemaItem[];

  docsLink: string;
}

function IntegrationConfigurationDialog(
  props: IntegrationConfigurationDialogProps,
) {
  const {
    configSchema,
    config,
    setConfig,
    docsLink,
    name: integrationName,
  } = props;

  const t = useTranslations('Integrations');

  const [isOpen, setIsOpen] = useState(false);

  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setConfig(localConfig);
      setIsOpen(false);
    },
    [localConfig, setConfig],
  );

  const handleCancel = useCallback(() => {
    setLocalConfig(config);
    setIsOpen(false);
  }, [config]);

  const handleConfigChange = useCallback((key: string, value: string) => {
    setLocalConfig((prevConfig) => ({
      ...prevConfig,
      [key]: value,
    }));
  }, []);

  return (
    <Dialog
      isOpen={isOpen}
      trigger={<Button size="small" color="secondary" label={t('configure')} />}
      onSubmit={handleSave}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }

        setIsOpen(open);
      }}
      title={t('IntegrationConfigurationDialog.title', { integrationName })}
    >
      <VStack gap="form">
        <Alert
          title={t.rich('IntegrationConfigurationDialog.description', {
            link: (chunks) => (
              <Link href={docsLink} target="_blank">
                {chunks}
              </Link>
            ),
          })}
          variant="info"
        ></Alert>
        {configSchema.map((schemaItem) => (
          <RawInput
            fullWidth
            key={schemaItem.key}
            label={schemaItem.label}
            value={localConfig[schemaItem.key] || ''}
            onChange={(value) => {
              handleConfigChange(schemaItem.key, value.target.value);
            }}
          />
        ))}
      </VStack>
    </Dialog>
  );
}

interface IntegrationCardOptions {
  icon: React.ReactNode;
  name: string;
  description: string;
  docsLink: string;
  configSchema: ConfigSchemaItem[];
}

interface IntegrationCardProps extends IntegrationCardOptions {
  configDetails: ConfigurationDetails;
}

function IntegrationCard(props: IntegrationCardProps) {
  const { icon, name, docsLink, description, configSchema, configDetails } =
    props;
  const t = useTranslations('Integrations');

  return (
    <HStack
      align="center"
      border
      paddingY="small"
      paddingX="large"
      justify="spaceBetween"
    >
      <HStack gap="medium">
        <Slot className="w-6 h-6">{icon}</Slot>
        <VStack gap="text">
          <HStack>
            <Typography align="left" variant="body" bold>
              {name}
            </Typography>
          </HStack>
          <Typography align="left" color="lighter" variant="body2">
            {description}
          </Typography>
        </VStack>
      </HStack>
      <HStack>
        <Button
          href={docsLink}
          target="_blank"
          size="small"
          color="tertiary"
          label={t('learnMore')}
        />
        <IntegrationConfigurationDialog
          {...configDetails}
          docsLink={docsLink}
          configSchema={configSchema}
          name={name}
        />
      </HStack>
    </HStack>
  );
}

interface SettingsEditorProps {
  settings: SettingsConfig;
  onSave: (settings: SettingsConfig) => void;
}

function SettingsEditor(props: SettingsEditorProps) {
  const { settings, onSave } = props;
  const t = useTranslations('Integrations');

  const integrations: IntegrationCardOptions[] = useMemo(
    () => [
      {
        icon: <OpenaiLogoMarkDynamic />,
        name: 'OpenAI',
        description: t('integrations.openAI.description'),
        docsLink: 'https://docs.letta.com/guides/server/providers/openai',
        configSchema: [
          { key: 'OPENAI_API_KEY', label: t('integrations.openAI.keyLabel') },
        ],
      },
      {
        icon: <AnthropicLogoMarkDynamic />,
        name: 'Anthropic',
        description: t('integrations.anthropic.description'),
        docsLink: 'https://docs.letta.com/guides/server/providers/anthropic',
        configSchema: [
          {
            key: 'ANTHROPIC_API_KEY',
            label: t('integrations.anthropic.keyLabel'),
          },
        ],
      },
      {
        icon: <OllamaLogoMarkDynamic />,
        name: 'Ollama',
        description: t('integrations.ollama.description'),
        docsLink: 'https://docs.letta.com/guides/server/providers/ollama',
        configSchema: [
          { key: 'OLLAMA_BASE_URL', label: t('integrations.ollama.urlLabel') },
        ],
      },
      {
        icon: <AzureLogoMarkDynamic />,
        name: 'Azure',
        description: t('integrations.azure.description'),
        docsLink:
          'https://docs.letta.com/guides/server/providers/azure#enabling-azure-openai-models',
        configSchema: [
          { key: 'AZURE_API_KEY', label: t('integrations.azure.keyLabel') },
          { key: 'AZURE_BASE_URL', label: t('integrations.azure.urlLabel') },
        ],
      },
      {
        icon: <ComposioLogoMarkDynamic />,
        name: 'Composio',
        description: t('integrations.composio.description'),
        docsLink: 'https://docs.letta.com/guides/agents/tools#composio-tools',
        configSchema: [
          {
            key: 'COMPOSIO_API_KEY',
            label: t('integrations.composio.keyLabel'),
          },
        ],
      },
    ],
    [t],
  );

  return (
    <VStack>
      {integrations.map((integration) => (
        <IntegrationCard
          configDetails={{
            config: settings,
            setConfig: onSave,
          }}
          key={integration.name}
          {...integration}
        />
      ))}
    </VStack>
  );
}

type SettingsConfig = Record<string, string>;

export function Integrations() {
  const t = useTranslations('Integrations');
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [unserializedSettings, setUnserializedSettings] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(window, 'lettaConfig')) {
      return;
    }

    void window.lettaConfig.load();

    window.lettaConfig.onLoad((config) => {
      // config format is key=value\n

      const nextSettings = config.split('\n').reduce((acc, line) => {
        const [key, value] = line.split('=');
        return {
          ...acc,
          [key]: value,
        };
      }, {});

      setUnserializedSettings(config);
      setSettings(nextSettings);
    }, []);

    return () => {
      window.lettaConfig.onLoad(() => {
        return;
      });
    };
  }, []);

  const handleSave = useCallback(() => {
    if (settings === null) {
      return;
    }

    const serializedSettings = Object.entries(settings)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    if (serializedSettings === unserializedSettings) {
      return;
    }

    void window.lettaConfig.save(serializedSettings);
  }, [settings, unserializedSettings]);

  useEffect(() => {
    handleSave();
  }, [settings]);

  return (
    <DesktopPageLayout
      icon={<CommunicationsIcon />}
      subtitle={t('subtitle')}
      title={t('title')}
    >
      <VStack fullWidth fullHeight padding="small">
        {settings === null ? (
          <LoadingEmptyStatusComponent
            isLoading
            loadingMessage={t('loading')}
          />
        ) : (
          <SettingsEditor
            settings={settings}
            onSave={(newSettings) => {
              if (settings === null) {
                return;
              }

              setSettings(newSettings);
            }}
          />
        )}
      </VStack>
    </DesktopPageLayout>
  );
}
