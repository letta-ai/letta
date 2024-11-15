export interface CookieSessionType {
  sessionId: string;
  expires: number;
}

export enum CookieNames {
  CSRF_PROTECTION = 'CSRF_PROTECTION',
  LETTA_SESSION = '__LETTA_SESSION__',
  THEME = '__THEME__',
  LOCALE = '__LOCALE__',
}

export interface CookieTypePayload {
  [CookieNames.LETTA_SESSION]: CookieSessionType;
  [CookieNames.CSRF_PROTECTION]: string;
  [CookieNames.THEME]: string;
  [CookieNames.LOCALE]: string;
}
