import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTheme } from '../lib/theme';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Sun, Moon, Laptop, Link2, Keyboard } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useUser();
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your interface preferences, connected services, and account controls.
          </p>
        </div>
      </div>

      {/* Theme & Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appearance & Theme</CardTitle>
          <CardDescription>
            Choose your preferred color theme. Current active appearance:{' '}
            <span className="font-semibold text-foreground capitalize">{resolvedTheme}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant={theme === 'light' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
              leftIcon={<Sun className="w-3.5 h-3.5" />}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
              leftIcon={<Moon className="w-3.5 h-3.5" />}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
              leftIcon={<Laptop className="w-3.5 h-3.5" />}
            >
              System Default
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account Information</CardTitle>
          <CardDescription>Managed securely by Clerk authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded bg-surface-2 border border-border-subtle space-y-1">
              <span className="text-muted-foreground">User Name</span>
              <p className="font-semibold text-foreground">
                {user?.fullName || user?.firstName || 'User'}
              </p>
            </div>
            <div className="p-3 rounded bg-surface-2 border border-border-subtle space-y-1">
              <span className="text-muted-foreground">Primary Email</span>
              <p className="font-semibold text-foreground">
                {user?.primaryEmailAddress?.emailAddress || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts Section (inside Settings as specified) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Connected Accounts</CardTitle>
            <Badge variant="secondary">Upcoming Phase</Badge>
          </div>
          <CardDescription>
            Third-party integrations (GitHub, LeetCode, Google Calendar, WakaTime) will be connected
            here in the Integrations phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No external accounts connected yet. Integrations will be established in subsequent phases.
          </p>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-surface-2 border border-border-subtle">
              <span className="text-muted-foreground">Command Palette</span>
              <kbd className="px-2 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                Cmd / Ctrl + K
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-2 border border-border-subtle">
              <span className="text-muted-foreground">Close Overlays / Modals</span>
              <kbd className="px-2 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                Escape
              </kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
