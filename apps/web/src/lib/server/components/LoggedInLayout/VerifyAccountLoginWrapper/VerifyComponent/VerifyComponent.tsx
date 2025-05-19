import React, { useMemo } from 'react';
import {
  Button,
  CheckIcon,
  HStack,
  MailIcon,
  PhoneIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { VerifyPhoneNumberDialog } from '$web/server/components/LoggedInLayout/VerifyAccountLoginWrapper/VerifyComponent/VerifyPhoneNumberDialog/VerifyPhoneNumberDialog';
import { VerifyEmailDialog } from '$web/server/components/LoggedInLayout/VerifyAccountLoginWrapper/VerifyComponent/VerifyEmailDialog/VerifyEmailDialog';

type VerifyType = 'email' | 'phone';

interface VerifyComponentProps {
  type: VerifyType;
  isVerified: boolean;
}

function VerifiedSuccessButton() {
  const t = useTranslations('VerifyAccountLoginWrapper');

  return (
    <Button
      color="secondary"
      disabled
      label={t('success')}
      preIcon={<CheckIcon />}
    />
  );
}

export function VerifyComponent(props: VerifyComponentProps) {
  const { type, isVerified } = props;

  const t = useTranslations('VerifyAccountLoginWrapper/VerifyComponent');

  const copy = useMemo(() => {
    switch (type) {
      case 'email':
        return {
          icon: <MailIcon />,
          title: t('email.title'),
          description: t('email.description'),
          cta: t('email.cta'),
        };
      case 'phone':
        return {
          icon: <PhoneIcon />,
          title: t('phone.title'),
          description: t('phone.description'),
          cta: t('phone.cta'),
        };
    }
  }, [type, t]);

  return (
    <HStack align="center" border padding="small">
      <HStack fullWidth justify="spaceBetween" gap="medium" align="center">
        <HStack gap="medium" align="center">
          <HStack color="background-grey2" padding="small">
            {copy.icon}
          </HStack>
          <VStack paddingRight gap={false}>
            <Typography bold>{copy.title}</Typography>
            <Typography color="lighter">{copy.description}</Typography>
          </VStack>
        </HStack>
        {type === 'phone' ? (
          <VerifyPhoneNumberDialog
            trigger={
              isVerified ? (
                <VerifiedSuccessButton />
              ) : (
                <Button label={copy.cta} color="secondary" />
              )
            }
          />
        ) : (
          <VerifyEmailDialog
            trigger={
              isVerified ? (
                <VerifiedSuccessButton />
              ) : (
                <Button label={copy.cta} color="secondary" />
              )
            }
          />
        )}
      </HStack>
    </HStack>
  );
}
