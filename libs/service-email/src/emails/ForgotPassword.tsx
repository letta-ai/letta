import * as React from 'react';
import { Html, Text, Link } from '@react-email/components';
import { makeGetEmailTranslation } from '../translations';

export interface ForgotPasswordProps {
  forgotPasswordUrl: string;
  locale: string;
}

function ForgotPassword(props: ForgotPasswordProps) {
  const { forgotPasswordUrl = '', locale = 'en' } = props;

  const t = makeGetEmailTranslation(locale);

  return (
    <Html lang={locale}>
      <Text>{t('forgotPassword.heading')}</Text>
      <Text>{t('forgotPassword.content')}</Text>
      <Link href={forgotPasswordUrl}>{forgotPasswordUrl}</Link>
    </Html>
  );
}

export function getForgotPasswordSubject({
  locale = 'en',
}: ForgotPasswordProps) {
  const t = makeGetEmailTranslation(locale);

  return t('forgotPassword.subject');
}

export default ForgotPassword;
