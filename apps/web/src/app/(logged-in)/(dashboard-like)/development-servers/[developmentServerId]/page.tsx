'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function DevelopmentServerPage() {
  const headerList = await headers();

  const currentPath = headerList.get('current-path');
  // get developmentServerId from headerList

  const developmentServerId = currentPath?.split('/')[2];

  return redirect(`/development-servers/${developmentServerId}/dashboard`);
}
