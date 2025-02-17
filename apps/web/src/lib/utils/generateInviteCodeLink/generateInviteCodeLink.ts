import { environment } from '@letta-cloud/environmental-variables';

export function generateInviteCodeLink(code: string) {
  return `${environment.NEXT_PUBLIC_CURRENT_HOST}/signup-via-invite?code=${code}`;
}
