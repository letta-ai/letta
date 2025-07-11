import { useLocation, useNavigate } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: navigate,
  };
}

export function useParams() {
  const location = useLocation();

  const urlRegex = new RegExp(
    `/agents/(?<agentId>[^/]+)(?<templateName>/[^/]+)?$`,
  );

  const match = urlRegex.exec(location.pathname);

  const { agentId, templateName } = match?.groups || {
    agentId: '',
    templateName: '',
  };

  return { agentId, templateName };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  return {
    get: (key: string) => searchParams.get(key),
    has: (key: string) => searchParams.has(key),
    getAll: (key: string) => searchParams.getAll(key),
    entries: () => searchParams.entries(),
  };
}
