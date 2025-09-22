import { CenterPage } from '../shared/CenterPage/CenterPage';
import {
  CopyButton,
  HStack,
  Logo,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ServerStatus } from '../shared/ServerStatus/ServerStatus';
import { useNavigate } from 'react-router-dom';

export function ConnectToLetta() {
  const t = useTranslations('ConnectToLetta');

  const navigate = useNavigate();

  function handleOnConnect() {
    navigate('/agents');
  }

  return (
    <CenterPage>
      <VStack
        className="max-w-[400px]"
        paddingTop="xxlarge"
        padding="xxlarge"
        align="center"
        justify="center"
      >
        <VStack fullHeight align="center">
          <VStack paddingY>
            <Logo size="large" />
          </VStack>
          <Typography variant="heading1">{t('title')}</Typography>
          <Typography variant="body2">{t('description')}</Typography>
        </VStack>
        <VStack gap="large" fullWidth paddingTop align="center">
          <HStack
            align="center"
            justify="center"
            gap={false}
            paddingX
            paddingY="xxsmall"
            fullWidth
            color="background-grey"
          >
            <Typography variant="body3" font="mono">
              letta-server
            </Typography>
            <CopyButton
              hideLabel
              color="tertiary"
              textToCopy={'letta-server'}
            />
          </HStack>
          <HStack>
            <ServerStatus onConnect={handleOnConnect} />
          </HStack>
        </VStack>
      </VStack>
    </CenterPage>
  );
}
