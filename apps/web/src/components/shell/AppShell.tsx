import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { cn } from '../../lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'avenza-sidebar-collapsed';

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const toggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // localStorage error handling
      }
      return next;
    });
  };

  // Global keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Content Wrapper - padded left to make room for fixed desktop sidebar */}
      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-[padding-left] duration-200 ease-in-out',
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'
        )}
      >
        {/* Topbar */}
        <Topbar
          onToggleMobileSidebar={() => setIsMobileOpen((prev) => !prev)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleSidebar={toggleCollapse}
      />
    </div>
  );
};
