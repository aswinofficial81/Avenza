import React from 'react';
import { Menu, Sun, Moon, Laptop, Command } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { useTheme } from '../../lib/theme';
import { Breadcrumbs } from '../navigation/Breadcrumbs';

export interface TopbarProps {
  onToggleMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onToggleMobileSidebar,
  onOpenCommandPalette,
}) => {
  const { theme, setTheme } = useTheme();

  const handleCycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const themeLabel =
    theme === 'system' ? 'System Theme' : theme === 'light' ? 'Light Theme' : 'Dark Theme';

  const themeIcon =
    theme === 'system' ? (
      <Laptop className="w-4 h-4 text-muted-foreground" />
    ) : theme === 'light' ? (
      <Sun className="w-4 h-4 text-amber-500" />
    ) : (
      <Moon className="w-4 h-4 text-sky-400" />
    );

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb navigation */}
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded bg-surface-2 hover:bg-surface border border-border-subtle text-muted-foreground hover:text-foreground text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
          aria-label="Open command palette (Ctrl+K)"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="font-sans">Search or jump to...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border">
            <span>⌘K</span>
          </kbd>
        </button>

        {/* Mobile Command Palette Icon */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="sm:hidden p-2 rounded text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        >
          <Command className="w-4 h-4" />
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={handleCycleTheme}
          aria-label={`Current: ${themeLabel}. Click to switch theme`}
          title={`Theme: ${themeLabel}`}
          className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        >
          {themeIcon}
        </button>

        {/* User Account Menu (Clerk) */}
        <div className="ml-1 pl-2 border-l border-border-subtle flex items-center">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-7 h-7 rounded border border-border',
              },
            }}
          />
        </div>
      </div>
    </header>
  );
};
