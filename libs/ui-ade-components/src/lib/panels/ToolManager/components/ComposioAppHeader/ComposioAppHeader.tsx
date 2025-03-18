import {
  Button,
  ExternalLinkIcon,
  HStack,
  Skeleton,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { capitalize } from 'lodash-es';
import { useTranslations } from '@letta-cloud/translations';

interface ComposioAppHeaderProps {
  name: string;
  appName?: string;
  logo?: string;
}

export function ComposioAppHeader(props: ComposioAppHeaderProps) {
  const { name, appName, logo } = props;

  const t = useTranslations('ToolManager/ComposioAppHeader');

  return (
    <HStack align="center" justify="spaceBetween">
      <HStack gap="large" align="center">
        <HStack
          color="background-grey"
          className="w-[64px] h-[64px]"
          align="center"
          justify="center"
        >
          {logo ? (
            <img src={logo} alt={name} className="w-[60%]  object-contain" />
          ) : (
            <Skeleton className="w-full h-full"></Skeleton>
          )}
        </HStack>
        <VStack gap={false}>
          <Typography>{name}</Typography>
          {appName && (
            <Typography variant="body2">{capitalize(appName)}</Typography>
          )}
        </VStack>
      </HStack>
      <Button
        label={t('open')}
        target="_blank"
        href={`https://app.composio.dev/app/${name}`}
        color="tertiary"
        size="small"
        postIcon={<ExternalLinkIcon />}
      />
    </HStack>
  );
}
