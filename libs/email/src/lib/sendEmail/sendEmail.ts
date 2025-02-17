import type { EmailPropMap } from '../types';
import { getResendClient } from '../getResendClient/getResendClient';
import Invite, { getInviteSubject } from '../../emails/invite';
import { createElement } from 'react';

interface SendEmailProps<
  EmailType extends keyof EmailPropMap = keyof EmailPropMap,
> {
  type: EmailType;
  options: EmailPropMap[EmailType];
  to: string;
}

const emailMap = {
  invite: {
    Component: Invite,
    getSubject: getInviteSubject,
  },
};

export async function sendEmail<
  EmailType extends keyof EmailPropMap = keyof EmailPropMap,
>(props: SendEmailProps<EmailType>) {
  const resendClient = getResendClient();

  if (!resendClient) {
    return;
  }

  const { type, options, to } = props;

  const mapped = emailMap[type];

  if (!mapped) {
    return;
  }

  const { getSubject, Component } = mapped;

  // send email logic
  return resendClient.emails
    .send({
      from: 'no-reploy@mail.letta.com',
      to,
      subject: getSubject(options),
      react: createElement(Component, options),
    })
    .then((res) => {
      console.log('Email sent', res);
    })
    .catch((e) => {
      console.error('Error sending email', e);
    });
}
