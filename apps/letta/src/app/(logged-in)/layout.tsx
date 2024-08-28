'use server';
import type { ReactNode } from 'react';

interface InAppProps {
  children: ReactNode;
}

export default async function LoggedInLayout(props: InAppProps) {
  const { children } = props;

  return <div>{children}</div>;
}
