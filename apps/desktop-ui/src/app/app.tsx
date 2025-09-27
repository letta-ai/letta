import {
  Route,
  Routes,
  Link,
  useLocation,
  Outlet,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Agents } from './pages/Agents/Agents';
import {
  Button,
  CogIcon,
  CommunicationsIcon,
  DatabaseIcon,
  HStack,
  IdentitiesIcon,
  LettaInvaderIcon,
  TerminalIcon,
  Toaster,
  ToolsIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ADE } from './pages/ADE/ADE';
import { GlobalTools } from './pages/GlobalTools/GlobalTools';
import { Homepage } from './pages/Homepage/Homepage';
import { useEffect } from 'react';
import { Integrations } from './pages/Integrations/Integrations';
import { NotConnectedOverlay } from './pages/shared/NotConnectedOverlay/NotConnectedOverlay';
import { ServerStatus } from './pages/ServerStatus/ServerStatus';
import { SetupProvider } from './pages/SetupProvider/SetupProvider';
import { Settings } from './pages/Settings/Settings';
import {
  IdentitiesTable,
  DataSourceDetailTable,
  DataSourcesList,
} from '@letta-cloud/ui-ade-components';
import { useDesktopConfig } from '@letta-cloud/utils-client';

function DataSourceDetailTableWrapper() {
  const { dataSourceId } = useParams<{ dataSourceId: string }>();

  if (!dataSourceId) {
    return <div>Data source not found</div>;
  }

  return <DataSourceDetailTable dataSourceId={dataSourceId} isDesktop={true} />;
}

function Sidebar() {
  const t = useTranslations('App');
  const { desktopConfig } = useDesktopConfig();
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
          tooltipPlacement="right"
        ></Button>
      </Link>
      <Link to="/dashboard/global-tools">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/global-tools'}
          preIcon={<ToolsIcon />}
          color="tertiary"
          label={t('Sidebar.globalTools')}
        ></Button>
      </Link>
      <Link to="/dashboard/identities">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/identities'}
          preIcon={<IdentitiesIcon />}
          color="tertiary"
          label={t('Sidebar.identities')}
          tooltipPlacement="right"
        ></Button>
      </Link>
      <Link to="/dashboard/data-sources">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/data-sources'}
          preIcon={<DatabaseIcon />}
          color="tertiary"
          label={t('Sidebar.dataSources')}
          tooltipPlacement="right"
        ></Button>
      </Link>
      {desktopConfig && desktopConfig.databaseConfig.type !== 'local' && (
        <Link to="/dashboard/server-status">
          <Button
            hideLabel
            active={location.pathname === '/dashboard/server-status'}
            preIcon={<TerminalIcon />}
            color="tertiary"
            label={t('Sidebar.serverStatus')}
            tooltipPlacement="right"
          ></Button>
        </Link>
      )}
      <Link to="/dashboard/integrations">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/integrations'}
          preIcon={<CommunicationsIcon />}
          color="tertiary"
          label={t('Sidebar.integrations')}
          tooltipPlacement="right"
        ></Button>
      </Link>
      <Link to="/dashboard/settings">
        <Button
          hideLabel
          active={location.pathname === '/dashboard/settings'}
          preIcon={<CogIcon />}
          color="tertiary"
          label={t('Sidebar.settings')}
          tooltipPlacement="right"
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
      border={window.electron.platform === 'win32'}
      color="background"
      gap={false}
      className="dark flex flex-col w-[100dvw] h-[100dvh]"
    >
      <AppHeader />
      <HStack overflow="hidden" fullWidth gap={false} fullHeight>
        <Sidebar />
        <div className="relative flex-1 min-w-0">
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
  }, [navigate]);

  function handleDataSourceNavigate(dataSourceId: string) {
    navigate(`/dashboard/data-sources/${dataSourceId}`);
  }

  return (
    <SetupProvider>
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
          <Route
            path="/dashboard/identities"
            element={
              <NotConnectedOverlay>
                <IdentitiesTable isDesktop />
              </NotConnectedOverlay>
            }
          />
          <Route
            path="/dashboard/data-sources"
            element={
              <NotConnectedOverlay>
                <DataSourcesList
                  isDesktop={true}
                  onNavigate={handleDataSourceNavigate}
                />
              </NotConnectedOverlay>
            }
          />
          <Route
            path="/dashboard/data-sources/:dataSourceId"
            element={
              <NotConnectedOverlay>
                <DataSourceDetailTableWrapper />
              </NotConnectedOverlay>
            }
          />
          <Route path="/dashboard/integrations" element={<Integrations />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route
            path="/dashboard/global-tools"
            element={
              <NotConnectedOverlay>
                <GlobalTools />
              </NotConnectedOverlay>
            }
          />
        </Route>
      </Routes>
      <Toaster />
    </SetupProvider>
  );
}

export default App;
