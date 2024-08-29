'use server';
import type { ReactNode } from 'react';
import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';

interface InAppProps {
  children: ReactNode;
}

export default async function LoggedInLayout(props: InAppProps) {
  const { children } = props;

  const user = await getUser();

  if (!user) {
    redirect('/login');

    return null;
  }

  return <div>{children}</div>;
}
