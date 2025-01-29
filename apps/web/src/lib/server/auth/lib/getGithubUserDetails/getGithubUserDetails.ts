import axios from 'axios';
import type { ProviderUserPayload } from '@letta-cloud/web-api-client';
import { LoginErrorsEnum } from '$web/errors';

interface GithubUserResponse {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string;
  company: string;
  blog: string;
  location: string;
  email: string;
  hireable: boolean;
  bio: string;
  twitter_username: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  private_gists: number;
  total_private_repos: number;
  owned_private_repos: number;
  disk_usage: number;
  collaborators: number;
  two_factor_authentication: boolean;
  plan: Plan;
}

export interface Plan {
  name: string;
  space: number;
  private_repos: number;
  collaborators: number;
}

interface EmailResponseItem {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string;
}

export async function getGithubUserDetails(
  accessToken: string,
): Promise<ProviderUserPayload> {
  const emailsResponse = await axios.get<EmailResponseItem[]>(
    'https://api.github.com/user/emails',
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!emailsResponse.data.length) {
    throw new Error(LoginErrorsEnum.GITHUB_NO_EMAIL);
  }

  const primaryEmail = emailsResponse.data.find(
    (email) => email.primary && email.verified,
  );

  if (!primaryEmail) {
    throw new Error(LoginErrorsEnum.GITHUB_NO_VERIFIED_EMAIL);
  }

  const userResponse = await axios.get<GithubUserResponse>(
    'https://api.github.com/user',
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!userResponse.data) {
    throw new Error(LoginErrorsEnum.GITHUB_NO_USER);
  }

  return {
    email: primaryEmail.email,
    uniqueId: `github-${userResponse.data.node_id.toString()}`,
    imageUrl: userResponse.data.avatar_url,
    provider: 'github',
    name: userResponse.data.name || primaryEmail.email,
  };
}
