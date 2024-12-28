import { Route, Routes, Link, useNavigation } from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Homepage } from './pages/Homepage/Homepage';
import {
  Button,
  Frame,
  HStack,
  LettaInvaderIcon,
  VStack,
} from '@letta-web/component-library';
import { useTranslation } from 'react-i18next';

function Sidebar() {
  const { t } = useTranslation('App', { keyPrefix: 'Sidebar' });
  return (
    <VStack border padding="small" borderRight fullHeight>
      <Link to="/">
        <Button
          hideLabel
          active={window.location.pathname === '/'}
          preIcon={<LettaInvaderIcon />}
          color="tertiary-transparent"
          label={t('agents')}
        ></Button>
      </Link>
    </VStack>
  );
}

export function App() {
  return (
    <div className="flex flex-col w-[100dvw] h-[100dvh]">
      <AppHeader />
      <HStack padding="xxsmall" fullWidth gap="small" fullHeight>
        <Sidebar />
        <Frame border padding="small" fullWidth fullHeight>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route
              path="/page-2"
              element={
                <div>
                  <Link to="/">Click here to go back to root page.</Link>
                </div>
              }
            />
          </Routes>
        </Frame>
      </HStack>
    </div>
  );
}

export default App;
