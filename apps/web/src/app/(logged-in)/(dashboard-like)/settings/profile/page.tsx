import { redirect } from 'next/navigation';

export default function ProfilePage() {
  redirect('/settings/account');

  return null;
}
