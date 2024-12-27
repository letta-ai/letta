'use client';

interface LoggedInClientSideProvidersProps {
  children: React.ReactNode;
}

export function LoggedInClientSideProviders({
  children,
}: LoggedInClientSideProvidersProps) {
  return <>{children}</>;
}
