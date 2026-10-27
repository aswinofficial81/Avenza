import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/Tooltip';
import { NAV_SECTIONS, NavItem } from './nav-items';
import { Layers, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenCommandPalette: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenCommandPalette,
}) => {
  const handleItemClick = (item: NavItem, e: React.MouseEvent, isMobile = false) => {
    if (item.isAction && item.id === 'command-palette') {
      e.preventDefault();
      onOpenCommandPalette();
    }
    if (isMobile) {
      onCloseMobile();
    }
  };

  const renderNavLinks = (collapsed: boolean, isMobile: boolean) => (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          {!collapsed && (
            <h4 className="px-2.5 text-[10px] font-semibold text-muted-foreground/80 tracking-wider uppercase select-none">
              {section.title}
            </h4>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;

              const linkContent = (
                <NavLink
                  to={item.href}
                  onClick={(e) => handleItemClick(item, e, isMobile)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-xl text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                      collapsed
                        ? 'h-9 w-9 justify-center mx-auto'
                        : 'h-8 px-2.5 gap-2.5 w-full',
                      isActive && !item.isAction
                        ? 'bg-teal-500/10 text-teal-900 dark:text-[#2DE2C5] dark:bg-teal-400/15 font-semibold shadow-xs border border-teal-500/20'
                        : 'text-muted-foreground hover:bg-surface-2/70 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.id} content={item.label} side="right">
                    {linkContent}
                  </Tooltip>
                );
              }

              return <div key={item.id}>{linkContent}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        aria-label="Desktop Navigation"
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ease-in-out bg-surface border-r border-border select-none',
          isCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Desktop Brand Header */}
        <div
          className={cn(
            'flex items-center h-14 px-4 border-b border-border-subtle shrink-0 transition-all',
            isCollapsed ? 'justify-center px-2' : 'justify-start'
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#064E4A] dark:from-[#2DE2C5] dark:to-[#0F766E] text-white font-semibold shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-tight text-foreground leading-none">
                  {APP_NAME}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-0.5 truncate">
                  {APP_TAGLINE}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        {renderNavLinks(isCollapsed, false)}

        {/* Motivational Streak Widget (Visible when expanded) */}
        {!isCollapsed && (
          <div className="p-3 mx-2.5 mb-2 rounded-xl bg-gradient-to-br from-teal-500/10 via-surface-2/60 to-teal-500/5 border border-teal-500/20 flex items-start gap-2.5 shrink-0 select-none">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">Keep Going!</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                You're 3 days away from a new streak badge 🔥
              </p>
            </div>
          </div>
        )}

        {/* Footer Collapse Toggle on Desktop */}
        <div className="flex items-center justify-between p-2 border-t border-border-subtle shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors p-2',
              isCollapsed ? 'mx-auto justify-center' : 'w-full gap-2'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sheet */}
      <aside
        aria-label="Mobile Navigation"
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-in-out shadow-2xl flex flex-col h-full bg-surface border-r border-border select-none',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#064E4A] dark:from-[#2DE2C5] dark:to-[#0F766E] text-white font-semibold shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground leading-none">
                {APP_NAME}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-0.5 truncate">
                {APP_TAGLINE}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation List */}
        {renderNavLinks(false, true)}
      </aside>
    </>
  );
};
