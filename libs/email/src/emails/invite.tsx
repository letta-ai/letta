import * as React from 'react';
import { Html, Text, Link } from '@react-email/components';
import { makeGetEmailTranslation } from '../translations';

export interface InviteProps {
  inviteUrl: string;
  organizationName: string;
  locale: string;
}

function Invite(props: InviteProps) {
  const { inviteUrl = '', locale = 'en', organizationName = 'default' } = props;

  const t = makeGetEmailTranslation(locale);

  return (
    <Html lang={locale}>
      <Text>{t('invite.heading')}</Text>
      <Text>{t('invite.content', { team: organizationName })}</Text>
      <Link href={inviteUrl}>
        {t('invite.linkName', { team: organizationName })}
      </Link>
    </Html>
  );
}

export function getInviteSubject({
  locale = 'en',
  organizationName = 'default',
}: InviteProps) {
  const t = makeGetEmailTranslation(locale);

  return t('invite.subject', { team: organizationName });
}

export default Invite;
