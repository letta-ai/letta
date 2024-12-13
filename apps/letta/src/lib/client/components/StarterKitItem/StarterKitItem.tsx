import type { StarterKit } from '$letta/client';
import { useTranslations } from 'next-intl';
import { ImageCard, Typography, VStack } from '@letta-web/component-library';

interface StarterKitItemProps {
  starterKit: StarterKit;
  onSelectStarterKit: (title: string, starterKit: StarterKit) => void;
}

export function StarterKitItems(props: StarterKitItemProps) {
  const { starterKit, onSelectStarterKit } = props;
  const t = useTranslations('components/StarterKitItems');
  const { useGetTitle, useGetDescription, image } = starterKit;

  const title = useGetTitle();
  const description = useGetDescription();

  return (
    <ImageCard
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[270px]"
      onClick={() => {
        onSelectStarterKit(title, starterKit);
      }}
      imageUrl={image}
      altText=""
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
