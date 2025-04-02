import {
  Button,
  GithubLogoMarkDynamic,
  GoogleLogoMarkDynamic,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';

interface OAuthButtonsProps {
  spinOnClick?: () => void;
  type: 'login' | 'signup';
  searchParams: URLSearchParams;
}

export function OAuthButtons(props: OAuthButtonsProps) {
  const { spinOnClick, searchParams } = props;
  const t = useTranslations('login/LoginComponent');

  const { type } = props;

  const typeCopy = useMemo(
    () =>
      ({
        login: t('login'),
        signup: t('signup'),
      })[type],
    [t, type],
  );

  return (
    <VStack fullWidth>
      <Button
        fullWidth
        color="secondary"
        onClick={spinOnClick}
        href={`/auth/google/init?${searchParams.toString()}`}
        preIcon={<GoogleLogoMarkDynamic size="xsmall" />}
        label={t('google', { type: typeCopy })}
      />
      <Button
        fullWidth
        onClick={spinOnClick}
        color="secondary"
        href={`/auth/github/init?${searchParams.toString()}`}
        preIcon={<GithubLogoMarkDynamic size="xsmall" />}
        label={t('github', { type: typeCopy })}
      />
    </VStack>
  );
}
