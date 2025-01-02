import { useLocation, useNavigation } from 'react-router-dom';

export function useRouter() {
  return useNavigation();
}

export function useParams() {
  const location = useLocation();

  const urlRegex = new RegExp(
    `^/agents/(?<agentId>[^/]+)(?<templateName>/[^/]+)?$`,
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
