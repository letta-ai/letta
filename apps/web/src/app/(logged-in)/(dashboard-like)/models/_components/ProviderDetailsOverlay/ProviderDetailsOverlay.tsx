import { useTranslations } from '@letta-cloud/translations';
import {
  brandKeyToLogo,
  brandKeyToName,
  Button,
  HStack,
  isBrandKey,
  LoadingEmptyStatusComponent,
  Section,
  SideOverlay,
  SideOverlayHeader,
  StatusIndicator,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { Provider } from '@letta-cloud/sdk-core';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { DeleteProviderModal } from '../DeleteProviderModal/DeleteProviderModal';

interface ModelsListProps {
  providerName: string;
}

function ModelsList(props: ModelsListProps) {
  const { providerName } = props;
  const { data: models, isError } = useModelsServiceListModels({
    providerName,
  });

  const t = useTranslations('pages/models/ProviderDetailsOverlay');

  return (
    <Section
      title={t('ModelsList.title')}
      description={t('ModelsList.description')}
    >
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="max-h-[300px]"
        overflowY="auto"
        border
      >
        {!models || models.length === 0 ? (
          <LoadingEmptyStatusComponent
            loadingMessage={t('ModelsList.loading')}
            isLoading={!models}
            emptyAction={t('ModelsList.noModels')}
            isError={isError}
            errorMessage={t('ModelsList.error')}
          />
        ) : (
          <VStack gap={false}>
            {models.map((model, index) => (
              <HStack
                key={model.handle}
                padding="small"
                align="center"
                justify="spaceBetween"
                borderBottom={index !== models.length - 1}
              >
                <HStack align="center" gap="small">
                  <Typography>{model.model}</Typography>
                  <Typography variant="body4" color="muted">
                    ({model.handle})
                  </Typography>
                </HStack>
                <StatusIndicator status="active" />
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Section>
  );
}

interface ProviderDetailsOverlayProps {
  provider: Provider;
  setOpen: (open: boolean) => void;
  open: boolean;
}

export function ProviderDetailsOverlay(props: ProviderDetailsOverlayProps) {
  const { provider, setOpen, open } = props;

  const t = useTranslations('pages/models/ProviderDetailsOverlay');

  return (
    <>
      <SideOverlay title={t('title')} isOpen={open} onOpenChange={setOpen}>
        <VStack fullHeight fullWidth gap={false}>
          <SideOverlayHeader>
            <Typography bold variant="body2">
              {provider.name}
            </Typography>
          </SideOverlayHeader>
          <VStack gap="form" overflowY="auto" flex collapseHeight padding>
            <Section
              title={t('providerType')}
              actions={
                isBrandKey(provider.provider_type) ? (
                  <HStack>
                    {brandKeyToLogo(provider.provider_type)}
                    {brandKeyToName(provider.provider_type)}
                  </HStack>
                ) : (
                  provider.provider_type
                )
              }
            ></Section>
            <ModelsList providerName={provider.name} />
            <Section
              title={t('DeleteProvider.title')}
              description={t('DeleteProvider.description')}
            >
              <HStack>
                <DeleteProviderModal
                  onSuccess={() => {
                    setOpen(false);
                  }}
                  trigger={
                    <Button
                      label={t('DeleteProvider.trigger')}
                      color="destructive"
                    />
                  }
                  provider={provider}
                />
              </HStack>
            </Section>
          </VStack>
        </VStack>
      </SideOverlay>
    </>
  );
}
