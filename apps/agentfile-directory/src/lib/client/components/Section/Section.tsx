import {
  Button,
  ChevronRightIcon,
  HStack,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface SectionProps {
  title: string;
  seeMoreLink?: string;
  count?: string;
  children: React.ReactNode;
}

export function Section(props: SectionProps) {
  const { title, seeMoreLink, count, children } = props;

  const t = useTranslations('components/Section');
  return (
    <VStack>
      <HStack align="center">
        <HStack align="center" gap="large">
          <Typography variant="large" bold>
            {title}
          </Typography>
          {count && (
            <div className="border rounded-sm px-1 h-[22px] flex items-center justify-center">
              <Typography variant="body3" bold>
                {count}
              </Typography>
            </div>
          )}
        </HStack>
        {seeMoreLink && (
          <Button
            label={t('seeAll')}
            postIcon={<ChevronRightIcon />}
            color="tertiary"
            bold
            href={seeMoreLink}
          ></Button>
        )}
      </HStack>
      {children}
    </VStack>
  );
}
