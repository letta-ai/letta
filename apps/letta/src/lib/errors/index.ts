export enum LoginErrorsEnum {
  UNKNOWN_ERROR_CONTACT_SUPPORT = 'contact-support',
  USER_NOT_IN_WHITELIST = 'user-not-in-whitelist',
  BANNED = 'banned',
}

export const LoginErrorsMap: Record<LoginErrorsEnum, string> = {
  [LoginErrorsEnum.UNKNOWN_ERROR_CONTACT_SUPPORT]:
    'An unknown error occurred signing you in. Please contact support.',
  [LoginErrorsEnum.USER_NOT_IN_WHITELIST]:
    'You are not authorized to sign in. Please contact support.',
  [LoginErrorsEnum.BANNED]:
    'Your account has been restricted due to a possible violation of our terms of service. Please contact support.',
};

export function isTextALoginError(text: unknown): text is LoginErrorsEnum {
  if (typeof text !== 'string') {
    return false;
  }

  return text in LoginErrorsMap;
}
