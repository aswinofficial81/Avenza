import React, { useState, useEffect, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useTheme } from '../../lib/theme';
import {
  Search,
  ArrowRight,
  Sun,
  Moon,
  Laptop,
  Sidebar as SidebarIcon,
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  BookOpen,
  FileText,
  Binary,
  FolderGit2,
  Compass,
  Target,
  Calendar,
  Clock,
  BarChart3,
  History,
  Bot,
  Settings,
  Palette,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Preferences' | 'Development';
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
  keywords?: string[];
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleSidebar?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onToggleSidebar,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const navigate = useNavigate();
  const { setTheme } = useTheme();

  const commands: CommandItem[] = React.useMemo(
    () => [
      // Navigation
      {
        id: 'nav-overview',
        title: 'Go to Overview',
        category: 'Navigation',
        icon: LayoutDashboard,
        perform: () => navigate('/overview'),
        keywords: ['home', 'dashboard', 'overview'],
      },
      {
        id: 'nav-today',
        title: 'Go to Today',
        category: 'Navigation',
        icon: CalendarCheck,
        perform: () => navigate('/today'),
        keywords: ['today', 'daily', 'now'],
      },
      {
        id: 'nav-terms',
        title: 'Go to Terms',
        category: 'Navigation',
        icon: GraduationCap,
        perform: () => navigate('/academics/terms'),
        keywords: ['academics', 'terms', 'semesters'],
      },
      {
        id: 'nav-subjects',
        title: 'Go to Subjects',
        category: 'Navigation',
        icon: BookOpen,
        perform: () => navigate('/academics/subjects'),
        keywords: ['courses', 'classes', 'subjects'],
      },
      {
        id: 'nav-exams',
        title: 'Go to Exams',
        category: 'Navigation',
        icon: FileText,
        perform: () => navigate('/academics/exams'),
        keywords: ['tests', 'exams', 'assessments'],
      },
      {
        id: 'nav-dsa',
        title: 'Go to DSA',
        category: 'Navigation',
        icon: Binary,
        perform: () => navigate('/dsa'),
        keywords: ['algorithms', 'data structures', 'leetcode', 'dsa'],
      },
      {
        id: 'nav-projects',
        title: 'Go to Projects',
        category: 'Navigation',
        icon: FolderGit2,
        perform: () => navigate('/projects'),
        keywords: ['projects', 'code', 'build'],
      },
      {
        id: 'nav-career',
        title: 'Go to Career Pipeline',
        category: 'Navigation',
        icon: Compass,
        perform: () => navigate('/career'),
        keywords: ['career', 'jobs', 'pipeline', 'resume', 'applications', 'interviews'],
      },
      {
        id: 'nav-goals',
        title: 'Go to Goals',
        category: 'Navigation',
        icon: Target,
        perform: () => navigate('/goals'),
        keywords: ['goals', 'targets', 'okrs', 'plan'],
      },
      {
        id: 'nav-calendar',
        title: 'Go to Calendar',
        category: 'Navigation',
        icon: Calendar,
        perform: () => navigate('/calendar'),
        keywords: ['calendar', 'schedule', 'events'],
      },
      {
        id: 'nav-planner',
        title: 'Go to Planner',
        category: 'Navigation',
        icon: Clock,
        perform: () => navigate('/planner'),
        keywords: ['planner', 'timeline', 'plan'],
      },
      {
        id: 'nav-analytics',
        title: 'Go to Analytics',
        category: 'Navigation',
        icon: BarChart3,
        perform: () => navigate('/analytics'),
        keywords: ['analytics', 'metrics', 'insights', 'stats'],
      },
      {
        id: 'nav-weekly-review',
        title: 'Go to Weekly Review',
        category: 'Navigation',
        icon: History,
        perform: () => navigate('/weekly-review'),
        keywords: ['weekly', 'review', 'retro', 'reflection'],
      },
      {
        id: 'nav-ai-coach',
        title: 'Go to AI Coach',
        category: 'Navigation',
        icon: Bot,
        perform: () => navigate('/ai-coach'),
        keywords: ['ai', 'coach', 'assistant'],
      },
      {
        id: 'nav-settings',
        title: 'Go to Settings',
        category: 'Navigation',
        icon: Settings,
        perform: () => navigate('/settings'),
        keywords: ['settings', 'preferences', 'accounts'],
      },
      // Preferences & Shell
      {
        id: 'theme-light',
        title: 'Switch to Light Theme',
        category: 'Preferences',
        icon: Sun,
        perform: () => setTheme('light'),
        keywords: ['theme', 'light', 'white'],
      },
      {
        id: 'theme-dark',
        title: 'Switch to Dark Theme',
        category: 'Preferences',
        icon: Moon,
        perform: () => setTheme('dark'),
        keywords: ['theme', 'dark', 'night'],
      },
      {
        id: 'theme-system',
        title: 'Use System Theme',
        category: 'Preferences',
        icon: Laptop,
        perform: () => setTheme('system'),
        keywords: ['theme', 'system', 'auto'],
      },
      ...(onToggleSidebar
        ? [
            {
              id: 'toggle-sidebar',
              title: 'Toggle Sidebar Collapse',
              category: 'Preferences' as const,
              icon: SidebarIcon,
              perform: onToggleSidebar,
              keywords: ['sidebar', 'collapse', 'expand'],
            },
          ]
        : []),
      // Development
      {
        id: 'dev-design-system',
        title: 'Open Design System Showcase',
        category: 'Development',
        icon: Palette,
        perform: () => navigate('/design-system'),
        keywords: ['design', 'tokens', 'components', 'showcase', 'qa'],
      },
    ],
    [navigate, setTheme, onToggleSidebar]
  );

  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(lower);
      const matchCategory = cmd.category.toLowerCase().includes(lower);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(lower));
      return matchTitle || matchCategory || matchKeywords;
    });
  }, [commands, query]);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? filteredCommands.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].perform();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Palette Container */}
      <div
        className="relative w-full max-w-lg rounded-lg border border-border bg-surface text-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 border-b border-border bg-surface">
          <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filteredCommands.length > 0}
            aria-controls={listId}
            aria-activedescendant={
              filteredCommands[selectedIndex]
                ? `cmd-${filteredCommands[selectedIndex].id}`
                : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full h-11 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-sans"
          />
          <kbd className="hidden sm:inline-flex rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border-subtle">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          className="max-h-72 overflow-y-auto p-2 space-y-1"
        >
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  id={`cmd-${cmd.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    cmd.perform();
                    onClose();
                  }}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors select-none',
                    isSelected
                      ? 'bg-surface-2 text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{cmd.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground/80 uppercase">
                      {cmd.category}
                    </span>
                    {isSelected && <ArrowRight className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-surface-2 text-[11px] text-muted-foreground select-none">
          <div className="flex items-center gap-2">
            <span>Navigate</span>
            <kbd className="rounded bg-surface px-1 py-0.2 font-mono text-[10px] border border-border">
              ↑↓
            </kbd>
            <span>Select</span>
            <kbd className="rounded bg-surface px-1 py-0.2 font-mono text-[10px] border border-border">
              ↵
            </kbd>
          </div>
          <div>
            <span>Close</span>{' '}
            <kbd className="rounded bg-surface px-1 py-0.2 font-mono text-[10px] border border-border">
              ESC
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
