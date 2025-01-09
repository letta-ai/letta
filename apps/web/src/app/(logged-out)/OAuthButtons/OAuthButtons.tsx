import {
  Button,
  GithubLogoMarkDynamic,
  GoogleLogoMarkDynamic,
  VStack,
} from '@letta-cloud/component-library';
import { useTranslations } from '@letta-cloud/translations';

interface OAuthButtonsProps {
  spinOnClick?: () => void;
  searchParams: URLSearchParams;
}

export function OAuthButtons(props: OAuthButtonsProps) {
  const { spinOnClick, searchParams } = props;
  const t = useTranslations('login/LoginComponent');

  return (
    <VStack>
      <Button
        color="secondary"
        onClick={spinOnClick}
        href={`/auth/google/init?${searchParams.toString()}`}
        preIcon={<GoogleLogoMarkDynamic size="xsmall" />}
        label={t('google')}
      />
      <Button
        onClick={spinOnClick}
        color="secondary"
        href={`/auth/github/init?${searchParams.toString()}`}
        preIcon={<GithubLogoMarkDynamic size="xsmall" />}
        label={t('github')}
      />
    </VStack>
  );
}
