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
import { useTranslation } from 'react-i18next';

function Sidebar() {
  const { t } = useTranslation('App', { keyPrefix: 'Sidebar' });

  const location = useLocation();
  return (
    <VStack color="background-grey" padding="small" borderRight fullHeight>
      <Link to="/">
        <Button
          hideLabel
          active={location.pathname === '/'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary-transparent"
          label={t('agents')}
        ></Button>
      </Link>
      <Link to="/settings">
        <Button
          hideLabel
          active={location.pathname === '/settings'}
          preIcon={<CogIcon />}
          color="tertiary-transparent"
          label={t('agents')}
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
        <Frame overflowY="auto" padding="small" fullWidth fullHeight>
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
          </Routes>
        </Frame>
      </HStack>
    </HStack>
  );
}

export default App;
