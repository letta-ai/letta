import { getResendClient } from '../getResendClient/getResendClient';
import Invite, { getInviteSubject } from '../../emails/Invite';
import { createElement } from 'react';
import type { ComponentProps } from 'react';
import LowBalance, { getLowBalanceSubject } from '../../emails/LowBalance';

const emailMap = {
  invite: {
    Component: Invite,
    getSubject: getInviteSubject,
  },
  lowBalance: {
    Component: LowBalance,
    getSubject: getLowBalanceSubject,
  },
};

type EmailPropMap = typeof emailMap;

interface SendEmailProps<
  EmailType extends keyof EmailPropMap = keyof EmailPropMap,
> {
  type: EmailType;
  options: ComponentProps<EmailPropMap[EmailType]['Component']>;
  to: string[] | string;
}

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
      from: 'no-reply@mail.letta.com',
      to,
      // @ts-expect-error - this works, my typings are just bad
      subject: getSubject(options),
      // @ts-expect-error - this works, my typings are just bad
      react: createElement(Component, options),
    })
    .then((res) => {
      console.log('Email sent', res);
    })
    .catch((e) => {
      console.error('Error sending email', e);
    });
}
