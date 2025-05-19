import * as React from 'react';
import { Html, Text, Link } from '@react-email/components';
import { makeGetEmailTranslation } from '../translations';

export interface VerifyEmailProps {
  link: string;
  locale: string;
}

function VerifyEmail(props: VerifyEmailProps) {
  const { link, locale = 'en' } = props;

  const t = makeGetEmailTranslation(locale);

  return (
    <Html lang={locale}>
      <Text>{t('verifyEmail.heading')}</Text>
      <Text>{t('verifyEmail.content')}</Text>
      <Link href={link}>{link}</Link>
    </Html>
  );
}

export function getVerifyEmailSubject({ locale = 'en' }: VerifyEmailProps) {
  const t = makeGetEmailTranslation(locale);

  return t('verifyEmail.subject');
}

export default VerifyEmail;
