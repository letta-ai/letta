import { redirect } from 'next/navigation';

export default function RedirectToLogin() {
  return redirect('/login?signup=true');
}
