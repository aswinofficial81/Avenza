import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
} from '@clerk/clerk-react';
import { Layers, KeyRound, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/shell/AppShell';
import { AppRoutes } from './routes';
import { Button } from './components/ui/Button';

interface AppProps {
  isMissingKey?: boolean;
}

const SignedOutView: React.FC<{ isMissingKey?: boolean }> = ({ isMissingKey }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
      <main className="w-full max-w-xl text-center space-y-8">
        {/* Brand Icon & Name */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shadow-md mb-2">
          <Layers className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            {APP_NAME}
          </h1>
          <p className="text-xs font-semibold tracking-widest text-secondary uppercase">
            {APP_TAGLINE}
          </p>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Your personal operating system for growth.
          </p>
        </div>

        {isMissingKey ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-left text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
              <KeyRound className="w-4 h-4" />
              <span>Clerk Configuration Notice</span>
            </div>
            <p>
              To connect live Clerk authentication, add your Publishable Key to{' '}
              <code className="bg-surface px-1 py-0.5 rounded text-foreground font-mono">
                apps/web/.env
              </code>
              :
            </p>
            <pre className="bg-surface-2 p-2.5 rounded text-foreground font-mono text-[11px] overflow-x-auto border border-border-subtle">
              VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
            </pre>
          </div>
        ) : (
          /* Sign In / Sign Up CTAs using Clerk */
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <SignInButton mode="modal">
              <Button
                variant="primary"
                size="md"
                leftIcon={<LogIn className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Sign In
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button
                variant="outline"
                size="md"
                leftIcon={<UserPlus className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Get Started
              </Button>
            </SignUpButton>
          </div>
        )}

        {/* Security Foundation Note */}
        <div className="rounded-lg border border-border bg-surface p-5 text-left space-y-2 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <span>Architecture & Security Foundation</span>
          </div>
          <p className="leading-relaxed">
            Clerk manages identity credentials securely. Fastify verifies tokens server-side and
            resolves internal Avenza profiles backed by Supabase PostgreSQL.
          </p>
        </div>
      </main>

      <footer className="mt-12 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {APP_NAME}. {APP_TAGLINE}
      </footer>
    </div>
  );
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
