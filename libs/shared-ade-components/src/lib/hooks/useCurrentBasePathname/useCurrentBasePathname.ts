import { usePathname } from 'next/navigation';

export function useCurrentBasePathname() {
  const pathname = usePathname();

  // remove the last part of the pathname
  const parts = pathname.split('/');

  return parts.slice(0, parts.length - 1).join('/');
}
