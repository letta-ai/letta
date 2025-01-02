import { Route, Routes, Link, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Homepage } from './pages/Homepage/Homepage';
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

function Sidebar() {
  const t = useTranslations('App');

  const location = useLocation();
  return (
    <VStack color="background-grey" padding="small" borderRight fullHeight>
      <Link to="/">
        <Button
          hideLabel
          active={location.pathname === '/'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary-transparent"
          label={t('Sidebar.agents')}
        ></Button>
      </Link>
      <Link to="/settings">
        <Button
          hideLabel
          active={location.pathname === '/settings'}
          preIcon={<CogIcon />}
          color="tertiary-transparent"
          label={t('Sidebar.agents')}
        ></Button>
      </Link>
    </VStack>
  );
}

export function App() {
  return (
    <HStack
      color="background-grey"
      gap={false}
      className="dark flex flex-col w-[100dvw] h-[100dvh]"
    >
      <AppHeader />
      <HStack fullWidth gap={false} fullHeight>
        <Sidebar />
        <Frame overflowY="auto" fullWidth fullHeight>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route
              path="/settings"
              element={
                <div>
                  <Link to="/">Click here to go back to root page.</Link>
                </div>
              }
            />
            <Route path="/agents/:agentId" element={<ADE />} />
          </Routes>
        </Frame>
      </HStack>
    </HStack>
  );
}

export default App;
