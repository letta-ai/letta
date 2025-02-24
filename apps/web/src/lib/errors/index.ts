export enum LoginErrorsEnum {
  UNKNOWN_ERROR_CONTACT_SUPPORT = 'contact-support',
  USER_NOT_IN_WHITELIST = 'user-not-in-whitelist',
  EMAIL_ALREADY_EXISTS = 'email-already-exists',
  SSO_USER_EXISTS_AS_NOT_SSO = 'sso-user-exists-as-not-sso',
  BANNED = 'banned',
  EXPIRED_INVITE_CODE = 'expired-invite-code',
  INVALID_INVITE_CODE = 'invalid-invite-code',
  INVITE_MISMATCH_EMAIL = 'invite-mismatch-email',
  GITHUB_NO_EMAIL = 'github-no-email',
  GITHUB_NO_USER = 'github-no-user',
  GITHUB_NO_VERIFIED_EMAIL = 'github-no-verified-email',
}

export const LoginErrorsMap: Record<LoginErrorsEnum, string> = {
  [LoginErrorsEnum.EXPIRED_INVITE_CODE]:
    'The invite code you are using has expired. Please contact support.',
  [LoginErrorsEnum.INVALID_INVITE_CODE]:
    'The invite code you are using is invalid. Please contact support.',
  [LoginErrorsEnum.INVITE_MISMATCH_EMAIL]:
    'The email address you are using does not match the one on the invite. Please sign in with the correct email address.',
  [LoginErrorsEnum.UNKNOWN_ERROR_CONTACT_SUPPORT]:
    'An unknown error occurred signing you in. Please contact support.',
  [LoginErrorsEnum.USER_NOT_IN_WHITELIST]:
    'You are not authorized to sign in. Please contact support.',
  [LoginErrorsEnum.SSO_USER_EXISTS_AS_NOT_SSO]:
    "An account with this email already exists but was created outside of your organization's SSO configuration. Please contact your organization's administrator or sign into your existing account and delete it to proceed.",
  [LoginErrorsEnum.BANNED]:
    'Your account has been restricted due to a possible violation of our terms of service. Please contact support.',
  [LoginErrorsEnum.EMAIL_ALREADY_EXISTS]:
    'An account with this email already exists but was created using a different provider. Please sign in with a different provider.',
  [LoginErrorsEnum.GITHUB_NO_EMAIL]:
    'Could not find an email address associated with your Github account. Please add an email address to your Github account and try again.',
  [LoginErrorsEnum.GITHUB_NO_USER]:
    'Could not find user details associated with your Github account. This is usually due to permissions issues with your Github account. Please check your Github account settings and try again.',
  [LoginErrorsEnum.GITHUB_NO_VERIFIED_EMAIL]:
    'Could not find a verified or primary email address associated with your Github account. We use email addresses to identify users. Please add a verified primary email address to your Github account and try again.',
};

export function isTextALoginError(text: unknown): text is LoginErrorsEnum {
  if (typeof text !== 'string') {
    return false;
  }

  return text in LoginErrorsMap;
}
