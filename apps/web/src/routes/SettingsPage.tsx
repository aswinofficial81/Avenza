import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useTheme } from '../lib/theme';
import { useApiClient } from '../lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import {
  Sun,
  Moon,
  Laptop,
  Keyboard,
  Download,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Save,
} from 'lucide-react';
import { ConnectedAccountsSection } from '../features/integrations/components/ConnectedAccountsSection';
import { usePreferences, useUpdatePreferences } from '../features/preferences/usePreferences';

export const SettingsPage: React.FC = () => {
  const { user } = useUser();
  const clerk = useClerk();
  const apiClient = useApiClient();
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const isPasswordUser = Boolean(user?.passwordEnabled);

  // Study Schedule preferences state
  const { data: preferences, isLoading: isPrefsLoading } = usePreferences();
  const updatePrefsMutation = useUpdatePreferences();
  const [studyStart, setStudyStart] = useState('');
  const [studyEnd, setStudyEnd] = useState('');
  const [dailyMin, setDailyMin] = useState(30);
  const [dailyTarget, setDailyTarget] = useState(120);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Sync form fields once preferences load
  useEffect(() => {
    if (preferences) {
      setStudyStart(preferences.preferred_study_start ?? '');
      setStudyEnd(preferences.preferred_study_end ?? '');
      setDailyMin(preferences.daily_minimum_minutes);
      setDailyTarget(preferences.daily_target_minutes);
    }
  }, [preferences]);

  const handleSaveStudyPrefs = async () => {
    setPrefsError(null);
    setPrefsSaved(false);
    const HHmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (studyStart && !HHmmRegex.test(studyStart)) {
      setPrefsError('Study start must be a valid HH:mm time (e.g. 08:00).');
      return;
    }
    if (studyEnd && !HHmmRegex.test(studyEnd)) {
      setPrefsError('Study end must be a valid HH:mm time (e.g. 22:00).');
      return;
    }
    if (studyStart && studyEnd && studyStart >= studyEnd) {
      setPrefsError('Study start must be earlier than study end.');
      return;
    }
    if (dailyTarget < dailyMin) {
      setPrefsError('Daily target must be >= daily minimum.');
      return;
    }
    try {
      await updatePrefsMutation.mutateAsync({
        preferred_study_start: studyStart || null,
        preferred_study_end: studyEnd || null,
        daily_minimum_minutes: dailyMin,
        daily_target_minutes: dailyTarget,
      });
      setPrefsSaved(true);
    } catch (err: unknown) {
      setPrefsError(err instanceof Error ? err.message : 'Failed to save preferences.');
    }
  };

  const canSubmitDeletion =
    isPasswordUser &&
    confirmationText.trim() === 'DELETE MY ACCOUNT' &&
    password.trim().length > 0 &&
    !isDeleting;

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const data = await apiClient.get<Record<string, unknown>>('/api/v1/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `avenza-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitDeletion) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (isPasswordUser) {
        await apiClient.delete('/api/v1/auth/me', {
          confirmation: confirmationText.trim(),
          password,
          authMethod: 'password',
        });
      } else {
        await apiClient.delete('/api/v1/auth/me', {
          confirmation: confirmationText.trim(),
          authMethod: 'oauth',
        });
      }

      setDeleteSuccess(true);
      setTimeout(async () => {
        await clerk.signOut();
        window.location.href = '/';
      }, 1500);
    } catch (err: unknown) {
      setIsDeleting(false);
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloseModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setConfirmationText('');
    setPassword('');
    setDeleteError(null);
    setDeleteSuccess(false);
  };

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

      {/* Connected Accounts Section */}
      <ConnectedAccountsSection />

      {/* Study Schedule Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Study Schedule</CardTitle>
          </div>
          <CardDescription>
            Set your available study window and daily study targets. Avenza uses these to schedule
            tasks within your free time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPrefsLoading ? (
            <p className="text-xs text-muted-foreground">Loading preferences…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Study Window Start"
                  type="time"
                  value={studyStart}
                  onChange={(e) => { setStudyStart(e.target.value); setPrefsSaved(false); }}
                  disabled={updatePrefsMutation.isPending}
                />
                <Input
                  label="Study Window End"
                  type="time"
                  value={studyEnd}
                  onChange={(e) => { setStudyEnd(e.target.value); setPrefsSaved(false); }}
                  disabled={updatePrefsMutation.isPending}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Daily Minimum (minutes)"
                  type="number"
                  min={0}
                  max={1440}
                  value={String(dailyMin)}
                  onChange={(e) => { setDailyMin(Number(e.target.value)); setPrefsSaved(false); }}
                  disabled={updatePrefsMutation.isPending}
                  description="Least amount of study per day"
                />
                <Input
                  label="Daily Target (minutes)"
                  type="number"
                  min={0}
                  max={1440}
                  value={String(dailyTarget)}
                  onChange={(e) => { setDailyTarget(Number(e.target.value)); setPrefsSaved(false); }}
                  disabled={updatePrefsMutation.isPending}
                  description="Ideal study goal per day"
                />
              </div>
              {prefsError && (
                <Alert variant="danger" title="Cannot Save">
                  {prefsError}
                </Alert>
              )}
              {prefsSaved && (
                <Alert variant="success" title="Preferences Saved">
                  Your study schedule has been updated. New plans will use these settings.
                </Alert>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveStudyPrefs}
                isLoading={updatePrefsMutation.isPending}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Save Study Schedule
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data & Privacy: Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Data & Privacy</CardTitle>
          </div>
          <CardDescription>
            Download a complete JSON export of all your personal data, goals, tasks, academics, and evidence logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportError && (
            <Alert variant="danger" title="Export Failed">
              {exportError}
            </Alert>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            isLoading={isExporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export All Account Data (JSON)
          </Button>
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

      {/* Danger Zone: Account Deletion */}
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardHeader>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <CardTitle className="text-sm text-rose-600 dark:text-rose-400">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and all associated workspace data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Account...
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseModal}
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Delete Account Permanently</span>
          </div>
        }
        description="This action is irreversible and will permanently purge all your data."
      >
        <form onSubmit={handleDeleteAccount} className="space-y-4 text-xs">
          <Alert variant="danger">
            <strong>Warning:</strong> Deleting your account will permanently delete all your profiles,
            goals, tasks, focus sessions, evidence items, and revoke all external provider integrations (GitHub, Google Calendar).
          </Alert>

          {isPasswordUser ? (
            <div className="space-y-1.5">
              <Input
                label="Account Password"
                type="password"
                placeholder="Enter your current password to authenticate"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isDeleting}
              />
            </div>
          ) : (
            <Alert variant="warning" title="Password Required for Self-Service Deletion">
              <div className="space-y-2">
                <p>
                  Your account is authenticated via OAuth/social login without a password. Self-service
                  account deletion currently requires server-side password verification for security.
                </p>
                <p className="font-semibold">
                  Next step: Please add a password to your account in your Clerk profile settings to proceed
                  with self-service deletion, or contact support for manual deletion assistance.
                </p>
              </div>
            </Alert>
          )}

          {isPasswordUser && (
            <div className="space-y-1.5">
              <Input
                label='To confirm, type "DELETE MY ACCOUNT" below:'
                placeholder="DELETE MY ACCOUNT"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                required
                disabled={isDeleting}
              />
            </div>
          )}

          {deleteError && (
            <Alert variant="danger" title="Deletion Request Failed">
              {deleteError}
            </Alert>
          )}

          {deleteSuccess && (
            <Alert variant="success" title="Account Deleted">
              Your account has been deleted successfully. Signing out...
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!canSubmitDeletion}
              isLoading={isDeleting}
            >
              {isPasswordUser ? 'Permanently Delete Account' : 'Password Required to Delete'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};