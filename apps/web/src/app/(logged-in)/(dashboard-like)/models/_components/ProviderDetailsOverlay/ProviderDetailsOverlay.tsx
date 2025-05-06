import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  Section,
  SideOverlay,
  SideOverlayHeader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { Provider } from '@letta-cloud/sdk-core';
import { DeleteProviderModal } from '../DeleteProviderModal/DeleteProviderModal';

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
        <VStack gap={false}>
          <SideOverlayHeader>
            <Typography bold variant="body2">
              {provider.name}
            </Typography>
          </SideOverlayHeader>
          <VStack padding>
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
