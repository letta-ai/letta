enum Mode {
  FORGOT_PASSWORD = 'forgot-password',
  RESET_PASSWORD = 'reset-password',
  LOGIN = 'login',
  SIGNUP = 'signup',
  SSO = 'login/sso',
}

type LoginAndSignupType = Mode.LOGIN | Mode.SIGNUP;

export { Mode };
export type { LoginAndSignupType };
