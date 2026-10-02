import React from 'react';
import {
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
  Command,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'HOME',
    items: [
      { id: 'overview', label: 'Overview', href: '/overview', icon: LayoutDashboard },
      { id: 'today', label: 'Today', href: '/today', icon: CalendarCheck },
    ],
  },
  {
    title: 'ACADEMICS',
    items: [
      { id: 'terms', label: 'Terms', href: '/academics/terms', icon: GraduationCap },
      { id: 'subjects', label: 'Subjects', href: '/academics/subjects', icon: BookOpen },
      { id: 'exams', label: 'Exams', href: '/academics/exams', icon: FileText },
      { id: 'dsa', label: 'DSA', href: '/dsa', icon: Binary },
    ],
  },
  {
    title: 'BUILD',
    items: [
      { id: 'projects', label: 'Projects', href: '/projects', icon: FolderGit2 },
      { id: 'career', label: 'Career', href: '/career', icon: Compass },
    ],
  },
  {
    title: 'PLAN',
    items: [
      { id: 'goals', label: 'Goals', href: '/goals', icon: Target },
      { id: 'calendar', label: 'Calendar', href: '/calendar', icon: Calendar },
      { id: 'planner', label: 'Planner', href: '/planner', icon: Clock },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { id: 'weekly-review', label: 'Weekly Review', href: '/weekly-review', icon: History },
    ],
  },
  {
    title: 'AI',
    items: [
      { id: 'ai-coach', label: 'AI Coach', href: '/ai-coach', icon: Bot },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'command-palette', label: 'Command Palette', href: '#command-palette', icon: Command, isAction: true },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];
