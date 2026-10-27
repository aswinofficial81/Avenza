import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
} from '@clerk/clerk-react';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/shell/AppShell';
import { AppRoutes } from './routes';
import { LandingPage } from './components/landing/LandingPage';

interface AppProps {
  isMissingKey?: boolean;
}

const SignedOutView: React.FC<{ isMissingKey?: boolean }> = ({ isMissingKey }) => {
  return <LandingPage isMissingKey={isMissingKey} />;
};

export const App: React.FC<AppProps> = ({ isMissingKey = false }) => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          {isMissingKey ? (
            <SignedOutView isMissingKey={true} />
          ) : (
            <>
              <SignedIn>
                <AppShell>
                  <AppRoutes />
                </AppShell>
              </SignedIn>
              <SignedOut>
                <SignedOutView isMissingKey={false} />
              </SignedOut>
            </>
          )}
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
