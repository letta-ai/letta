import { signOutUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';

async function SignOutRoute() {
  await signOutUser();

  return redirect('/login');
}

export { SignOutRoute as GET };
