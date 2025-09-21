export interface CookieSessionType {
  sessionId: string;
  expires: number;
}

export enum CookieNames {
  CSRF_PROTECTION = 'CSRF_PROTECTION',
  LETTA_SESSION = '__LETTA_SESSION__',
  CLOUD_API_SESSION = '__CLOUD_API_SESSION__',
  THEME = '__THEME__',
  LOCALE = '__LOCALE__',
  LAST_VISITED_PROJECT = '__LAST_VISITED_PROJECT__',
}

interface LastVisitedProjects {
  [organizationId: string]: {
    slug: string;
    timestamp: number;
  };
}

export interface CookieTypePayload {
  [CookieNames.LETTA_SESSION]: CookieSessionType;
  [CookieNames.CLOUD_API_SESSION]: CookieSessionType;
  [CookieNames.CSRF_PROTECTION]: string;
  [CookieNames.THEME]: string;
  [CookieNames.LOCALE]: string;
  [CookieNames.LAST_VISITED_PROJECT]: LastVisitedProjects;
}
