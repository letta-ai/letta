import type { NewUserDetails } from '$web/server/auth';

interface GenerateRedirectSignatureForLoggedInUserOptions {
  newUserDetails?: NewUserDetails | undefined;
  redirectUrl?: string | undefined;
}

export async function generateRedirectSignatureForLoggedInUser(
  options: GenerateRedirectSignatureForLoggedInUserOptions,
) {
  const { newUserDetails, redirectUrl } = options;

  if (newUserDetails) {
    return new Response('Successfully signed in', {
      status: 302,
      headers: {
        location: `/projects/${newUserDetails.firstProjectSlug}/templates/${newUserDetails.firstCreatedAgentName}`,
      },
    });
  }

  return new Response('Successfully signed in', {
    status: 302,
    headers: {
      location: redirectUrl || '/',
    },
  });
}
