'use server';

import { getCookie, setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';

export async function recordProjectVisit(organizationId: string, projectSlug: string) {
  try {
    const existingCookie = await getCookie(CookieNames.LAST_VISITED_PROJECT);
    const cookieData = existingCookie || {};

    // Update with current project
    cookieData[organizationId] = {
      slug: projectSlug,
      timestamp: Date.now(),
    };

    // Save the cookie
    await setCookie(CookieNames.LAST_VISITED_PROJECT, cookieData);
  } catch (_e) {
    // Best effort - don't fail if cookie write fails
  }
}
