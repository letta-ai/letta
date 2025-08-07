import { useTranslations } from '@letta-cloud/translations';
import { Badge, ImageCard, Typography, VStack, WarningIcon } from '../../../';
import type { StarterKit } from '@letta-cloud/config-agent-starter-kits';

interface StarterKitItemProps {
  starterKit: StarterKit;
  onSelectStarterKit: (title: string, starterKit: StarterKit) => void;
}

export function StarterKitItems(props: StarterKitItemProps) {
  const { starterKit, onSelectStarterKit } = props;
  const t = useTranslations('components/StarterKitItems');
  const { useGetTitle, useGetDescription, image, name } = starterKit;

  const title = useGetTitle();
  const description = useGetDescription();

  return (
    <ImageCard
      className="h-[270px]"
      onClick={() => {
        onSelectStarterKit(name, starterKit);
      }}
      imageUrl={image}
      altText=""
      badge={
        starterKit.id === 'sleepTime' ? (
          <Badge
            content={t('newArchitecture')}
            preIcon={<WarningIcon />}
            variant="info"
          />
        ) : undefined
      }
      title={title}
      description={description}
    >
      <VStack paddingTop>
        {starterKit.tools && (
          <Typography variant="body2" align="left">
            {t.rich('tools', {
              strong: (v) => (
                <Typography variant="body2" overrideEl="span" bold>
                  {v}
                </Typography>
              ),
              toolsList: starterKit.tools.map((v) => v.name).join(', '),
            })}
          </Typography>
        )}
      </VStack>
    </ImageCard>
  );
}
