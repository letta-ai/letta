'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve all query params when redirecting
    const params = searchParams.toString();
    const redirectUrl = params
      ? `/settings/organization/projects?${params}`
      : '/settings/organization/projects';

    router.replace(redirectUrl);
  }, [router, searchParams]);

  // Return null while redirecting
  return null;
}
