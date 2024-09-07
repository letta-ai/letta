export enum LoginErrorsEnum {
  UNKNOWN_ERROR_CONTACT_SUPPORT = 'contact-support',
}

export const LoginErrorsMap: Record<LoginErrorsEnum, string> = {
  [LoginErrorsEnum.UNKNOWN_ERROR_CONTACT_SUPPORT]:
    'An unknown error occurred signing you in. Please contact support.',
};

export function isTextALoginError(text: unknown): text is LoginErrorsEnum {
  if (typeof text !== 'string') {
    return false;
  }

  return text in LoginErrorsMap;
}
