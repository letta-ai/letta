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
  DatabaseIcon,
  HStack,
  IdentitiesIcon,
  LettaInvaderIcon,
  Toaster,
  ToolsIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ADE } from './pages/ADE/ADE';
import { GlobalTools } from './pages/GlobalTools/GlobalTools';
import {
  IdentitiesTable,
  DataSourceDetailTable,
  DataSourcesList,
} from '@letta-cloud/ui-ade-components';

function DataSourceDetailTableWrapper() {
  const { dataSourceId } = useParams<{ dataSourceId: string }>();

  if (!dataSourceId) {
    return <div>Data source not found</div>;
  }

  return <DataSourceDetailTable dataSourceId={dataSourceId} isDesktop={true} />;
}

function Sidebar() {
  const t = useTranslations('App');
  const location = useLocation();

  return (
    <VStack padding="small" borderRight fullHeight>
      <Link to="/">
        <Button
          hideLabel
          active={location.pathname === '/'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary"
          label={t('Sidebar.agents')}
          tooltipPlacement="right"
        ></Button>
      </Link>
      <Link to="/tools">
        <Button
          hideLabel
          active={location.pathname === '/tools'}
          preIcon={<ToolsIcon />}
          color="tertiary"
          label={t('Sidebar.globalTools')}
        ></Button>
      </Link>
      <Link to="/identities">
        <Button
          hideLabel
          active={location.pathname === '/identities'}
          preIcon={<IdentitiesIcon />}
          color="tertiary"
          label={t('Sidebar.identities')}
          tooltipPlacement="right"
        ></Button>
      </Link>
      <Link to="/data-sources">
        <Button
          hideLabel
          active={location.pathname === '/data-sources'}
          preIcon={<DatabaseIcon />}
          color="tertiary"
          label={t('Sidebar.dataSources')}
          tooltipPlacement="right"
        ></Button>
      </Link>
    </VStack>
  );
}

function Dashboard() {

  return (
    <HStack
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



  function handleDataSourceNavigate(dataSourceId: string) {
    navigate(`/dashboard/data-sources/${dataSourceId}`);
  }

  return (
      <>
        <Routes>
          <Route path="/" element={<Dashboard />}>
            <Route
              path="/"
              element={
                <Agents />
              }
            />
            <Route
              path="/agents/:agentId"
              element={
                <ADE />
              }
            />
            <Route
              path="/identities"
              element={
                <IdentitiesTable isDesktop />
              }
            />
            <Route
              path="/data-sources"
              element={
                <DataSourcesList
                  isDesktop={true}
                  onNavigate={handleDataSourceNavigate}
                />
              }
            />
            <Route
              path="/data-sources/:dataSourceId"
              element={
                <DataSourceDetailTableWrapper />
              }
            />
            <Route
              path="/tools"
              element={
                <GlobalTools />
              }
            />
          </Route>
        </Routes>
        <Toaster />
      </>
  );
}

export default App;
