import { signOutUser } from '$web/server/auth';
import { redirect } from 'next/navigation';

async function SignOutRoute() {
  await signOutUser();

  return redirect('/login');
}

export { SignOutRoute as GET };
