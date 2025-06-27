import { useTranslations } from '@letta-cloud/translations';
import {
  FormField,
  MailIcon,
  CloseIcon,
  CheckIcon,
  VStack,
  HStack,
  Input,
  Typography,
} from '@letta-cloud/ui-component-library';
import { passwordValidation } from '../libs';
import type { SetStateAction, Dispatch } from 'react';
import { useFormContext } from 'react-hook-form';

interface EmailFieldProps {
  disabled?: boolean;
}

function EmailField({ disabled = false }: EmailFieldProps) {
  const t = useTranslations('auth/Generic');

  return (
    <FormField
      name="email"
      render={({ field }) => {
        return (
          <Input
            fullWidth
            size={'large'}
            label={t('email.label')}
            placeholder={t('email.placeholder')}
            postIcon={<MailIcon />}
            type="email"
            disabled={disabled}
            {...field}
          />
        );
      }}
    />
  );
}

interface PasswordAndConfirmationFieldsProps {
  passwordValue: string;
  setPasswordValue: Dispatch<SetStateAction<string>>;
  showSecurityCheck?: boolean;
}

function PasswordField() {
  const t = useTranslations('auth/Generic');
  const form = useFormContext();
  const email = form.watch('email');
  const forgotPasswordUrl = email
    ? `/forgot-password?email=${encodeURIComponent(email)}`
    : '/forgot-password';

  return (
    <FormField
      name="password"
      render={({ field }) => (
        <VStack gap="text" fullWidth>
          <Input
            fullWidth
            rightOfLabelContent={
              <Typography
                underline={false}
                variant="body3"
                bold
                color="default"
              >
                <a href={forgotPasswordUrl}>{t('forgotPassword')}</a>
              </Typography>
            }
            label={t('password.label')}
            size={'large'}
            placeholder={t('password.placeholder')}
            showVisibilityControls
            type="password"
            {...field}
            onChange={(e) => {
              field.onChange(e);
            }}
            onFocus={() => {
              form.clearErrors('password');
            }}
          />
        </VStack>
      )}
    />
  );
}

function PasswordAndConfirmationFields(
  props: PasswordAndConfirmationFieldsProps,
) {
  const t = useTranslations('auth/Generic');
  const { passwordValue, setPasswordValue } = props;
  const form = useFormContext();
  return (
    <VStack gap="medium">
      <FormField
        name="password"
        render={({ field }) => (
          <VStack gap="text" fullWidth>
            <Input
              fullWidth
              label={t('password.label')}
              size={'large'}
              placeholder={t('password.placeholder')}
              showVisibilityControls
              type="password"
              {...field}
              onChange={(e) => {
                field.onChange(e);
                setPasswordValue(e.target.value);
              }}
              onFocus={() => {
                form.clearErrors('password');
              }}
            />
            {passwordValue && (
              <PasswordSecurityCheck passwordValue={passwordValue} />
            )}
          </VStack>
        )}
      />
      <FormField
        name="confirmPassword"
        render={({ field }) => (
          <VStack gap="text" fullWidth>
            <Typography variant="body">{t('confirmPassword.label')}</Typography>
            <Input
              fullWidth
              label={''}
              hideLabel
              size={'large'}
              placeholder={t('confirmPassword.placeholder')}
              showVisibilityControls
              type="password"
              {...field}
            />
          </VStack>
        )}
      />
    </VStack>
  );
}

interface PasswordSecurityCheckProps {
  passwordValue: string;
}

function PasswordSecurityCheck({ passwordValue }: PasswordSecurityCheckProps) {
  return (
    <VStack fullWidth>
      <Typography variant="body3">Password requirements:</Typography>
      <VStack>
        <HStack>
          {passwordValidation(passwordValue).minLength ? (
            <CheckIcon size="xsmall" color="success" />
          ) : (
            <CloseIcon size="xsmall" color="destructive" />
          )}
          <Typography
            variant="body3"
            color={
              passwordValidation(passwordValue).minLength
                ? 'positive'
                : 'destructive'
            }
          >
            At least 8 characters
          </Typography>
        </HStack>
        <HStack>
          {passwordValidation(passwordValue).hasLowercase ? (
            <CheckIcon size="xsmall" color="success" />
          ) : (
            <CloseIcon size="xsmall" color="destructive" />
          )}
          <Typography
            variant="body3"
            color={
              passwordValidation(passwordValue).hasLowercase
                ? 'positive'
                : 'destructive'
            }
          >
            One lowercase letter
          </Typography>
        </HStack>
        <HStack>
          {passwordValidation(passwordValue).hasUppercase ? (
            <CheckIcon size="xsmall" color="success" />
          ) : (
            <CloseIcon size="xsmall" color="destructive" />
          )}
          <Typography
            variant="body3"
            color={
              passwordValidation(passwordValue).hasUppercase
                ? 'positive'
                : 'destructive'
            }
          >
            One uppercase letter
          </Typography>
        </HStack>
        <HStack>
          {passwordValidation(passwordValue).hasNumber ? (
            <CheckIcon size="xsmall" color="success" />
          ) : (
            <CloseIcon size="xsmall" color="destructive" />
          )}
          <Typography
            variant="body3"
            color={
              passwordValidation(passwordValue).hasNumber
                ? 'positive'
                : 'destructive'
            }
          >
            One number
          </Typography>
        </HStack>
        <HStack>
          {passwordValidation(passwordValue).hasSymbol ? (
            <CheckIcon size="xsmall" color="success" />
          ) : (
            <CloseIcon size="xsmall" color="destructive" />
          )}
          <Typography
            variant="body3"
            color={
              passwordValidation(passwordValue).hasSymbol
                ? 'positive'
                : 'destructive'
            }
          >
            One special character
          </Typography>
        </HStack>
      </VStack>
    </VStack>
  );
}

export { EmailField, PasswordField, PasswordAndConfirmationFields };
