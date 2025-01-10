import {
  Route,
  Routes,
  Link,
  useLocation,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Agents } from './pages/Agents/Agents';
import {
  Button,
  CogIcon, CommunicationsIcon,
  Frame,
  HStack,
  LettaInvaderIcon,
  TerminalIcon,
  VStack
} from '@letta-cloud/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ADE } from './pages/ADE/ADE';
import { Homepage } from './pages/Homepage/Homepage';
import { useEffect } from 'react';
import { Integrations } from './pages/Integrations/Integrations';
import { NotConnectedOverlay } from './pages/shared/NotConnectedOverlay/NotConnectedOverlay';
import { ServerStatus } from './pages/ServerStatus/ServerStatus';

function Sidebar() {
  const t = useTranslations('App');

  const location = useLocation();
  return (
    <VStack padding="small" borderRight fullHeight>
      <Link to="/dashboard/agents">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/agents'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary"
          label={t('Sidebar.agents')}
        ></Button>
      </Link>
      <Link to="/dashboard/server-status">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/server-status'}
          preIcon={<TerminalIcon />}
          color="tertiary"
          label={t('Sidebar.serverStatus')}
        ></Button>
      </Link>
      <Link to="/dashboard/integrations">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/integrations'}
          preIcon={<CommunicationsIcon />}
          color="tertiary"
          label={t('Sidebar.integrations')}
        ></Button>
      </Link>
    </VStack>
  );
}

function Dashboard() {
  useEffect(() => {
    window.electron.setToDashboardSize();
  }, []);

  return (
    <HStack
      color="background"
      gap={false}
      className="dark flex flex-col w-[100dvw] h-[100dvh]"
    >
      <AppHeader />
      <HStack overflow="hidden" fullWidth gap={false} fullHeight>
        <Sidebar />
        <div className="relative w-full">
          <Outlet />
        </div>
      </HStack>
    </HStack>
  );
}

export function App() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(window, 'router')) {
      window.router.onUpdateRoute((route) => {
        navigate(route);
      });
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/dashboard" element={<Dashboard />}>
        <Route
          path="/dashboard/agents"
          element={
            <NotConnectedOverlay>
              <Agents />
            </NotConnectedOverlay>
          }
        />
        <Route
          path="/dashboard/agents/:agentId"
          element={
            <NotConnectedOverlay>
              <ADE />
            </NotConnectedOverlay>
          }
        />
        <Route path="/dashboard/server-status" element={<ServerStatus />} />

        <Route path="/dashboard/integrations" element={<Integrations />} />
      </Route>
    </Routes>
  );
}

export default App;
