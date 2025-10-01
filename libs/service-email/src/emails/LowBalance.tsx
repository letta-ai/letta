import * as React from 'react';
import { Html, Text, Link } from '@react-email/components';
import { makeGetEmailTranslation } from '../translations';

export interface LowBalanceProps {
  organizationName: string;
  threshold: string;
  locale: string;
  topUpUrl: string;
}

function LowBalance(props: LowBalanceProps) {
  const {
    threshold = '$5.00',
    topUpUrl = 'https://app.letta.com/settings/organization/usage',
    locale = 'en',
    organizationName = 'default',
  } = props;

  const t = makeGetEmailTranslation(locale);

  return (
    <Html lang={locale}>
      <Text>{t('lowBalance.heading', { organizationName })}</Text>
      <Text>{t('lowBalance.content', { threshold })}</Text>
      <Link href={topUpUrl}>{topUpUrl}</Link>
    </Html>
  );
}

export function getLowBalanceSubject({
  locale = 'en',
  threshold = '$5.00',
}: LowBalanceProps) {
  const t = makeGetEmailTranslation(locale);

  return t('lowBalance.subject', { threshold });
}

export default LowBalance;
