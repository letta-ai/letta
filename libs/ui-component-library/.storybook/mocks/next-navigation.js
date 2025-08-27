import { action } from '@storybook/addon-actions';

// Mock Next.js navigation hooks for Storybook
export function useRouter() {
  return {
    push: action('router.push'),
    replace: action('router.replace'),
    back: action('router.back'),
    forward: action('router.forward'),
    refresh: action('router.refresh'),
    prefetch: action('router.prefetch'),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    isReady: true,
  };
}

export function usePathname() {
  return '/';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(url) {
  action('redirect')(url);
}

export function permanentRedirect(url) {
  action('permanentRedirect')(url);
}

export function notFound() {
  action('notFound')();
}
