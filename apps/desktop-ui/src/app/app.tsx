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
  CogIcon,
  Frame,
  HStack,
  LettaInvaderIcon,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ADE } from './pages/ADE/ADE';
import { Homepage } from './pages/Homepage/Homepage';
import { useEffect } from 'react';
import { CenterPage } from './pages/shared/CenterPage/CenterPage';
import { InstallLetta } from './pages/InstallLetta/InstallLetta';
import { ConnectToLetta } from './pages/ConnectToLetta/ConnectToLetta';
import { Settings } from './pages/Settings/Settings';

function Sidebar() {
  const t = useTranslations('App');

  const location = useLocation();
  return (
    <VStack color="background-grey" padding="small" borderRight fullHeight>
      <Link to="/dashboard/agents">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/agents'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary-transparent"
          label={t('Sidebar.agents')}
        ></Button>
      </Link>
      <Link to="/dashboard/settings">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/settings'}
          preIcon={<CogIcon />}
          color="tertiary-transparent"
          label={t('Sidebar.agents')}
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
      color="background-grey"
      gap={false}
      className="dark flex flex-col w-[100dvw] h-[100dvh]"
    >
      <AppHeader />
      <HStack fullWidth gap={false} fullHeight>
        <Sidebar />
        <Outlet />
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
      <Route path="/install-letta" element={<InstallLetta />} />
      <Route path="/connect-to-letta" element={<ConnectToLetta />} />
      <Route path="dashboard" element={<Dashboard />}>
        <Route path="/dashboard/agents" element={<Agents />} />
        <Route path="/dashboard/agents/:agentId" element={<ADE />} />
        <Route path="/dashboard/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
